import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLE, requireAdmin } from "@/lib/auth/authorization";
import { readJson, SecurityError, validateMutation } from "@/lib/security/http";
import { enforceLimits } from "@/lib/security/rate-limit";
import { managementActionSchema, userListSchema } from "@/schemas/userManagement";

const userSelect = { id: true, fname: true, lname: true, contact: true, email: true, cr: true, bannedAt: true } satisfies Prisma.UserSelect;
const profileSelect = { pr_id: true, pr_company: true, role: true } satisfies Prisma.PersonProfileSelect;
function userId(value: string) {
  if (!z.string().uuid().safeParse(value).success) throw new SecurityError(422, "INVALID_INPUT");
  return value;
}

export async function listUsers(request: Request) {
  await requireAdmin();
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(key => params.getAll(key).length !== 1)) throw new SecurityError(422, "INVALID_INPUT");
  const parsed = userListSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) throw new SecurityError(422, "INVALID_INPUT");
  const { page, limit, search, role, status } = parsed.data;
  const adminExists = Prisma.sql`EXISTS (SELECT 1 FROM "upro"."person_profile" p WHERE p."user_id" = u."id" AND p."role" = ${ADMIN_ROLE})`;
  // Bound parameters throughout, including search. strpos gives literal substring
  // matching rather than interpreting user-entered SQL wildcard characters.
  const where = Prisma.sql`WHERE (${search} = '' OR strpos(lower(concat_ws(' ', u."id"::text, u."fname", u."lname", u."email", u."contact")), lower(${search})) > 0)
    AND (${role} = '' OR (${role} = 'admin' AND ${adminExists}) OR (${role} = 'customer' AND NOT ${adminExists}))
    AND (${status} = '' OR (${status} = 'active' AND u."bannedAt" IS NULL) OR (${status} = 'banned' AND u."bannedAt" IS NOT NULL))`;
  return prisma.$transaction(async tx => {
    const counts = await tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT count(*) AS total FROM "entity"."users" u ${where}`);
    const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT u."id" FROM "entity"."users" u ${where} ORDER BY u."cr" DESC NULLS LAST, u."id" OFFSET ${(page - 1) * limit} LIMIT ${limit}`);
    const users = await tx.user.findMany({ where: { id: { in: ids.map(row => row.id) } }, select: userSelect });
    const profiles = await tx.personProfile.findMany({ where: { user_id: { in: ids.map(row => row.id) } }, select: { ...profileSelect, user_id: true }, orderBy: { pr_id: "asc" } });
    return { total: Number(counts[0]?.total ?? 0), data: ids.flatMap(({id}) => {
      const user = users.find(item => item.id === id);
      if (!user) return [];
      const ownProfiles = profiles.filter(profile => profile.user_id === id).map(profile => ({
        pr_id: profile.pr_id, pr_company: profile.pr_company, role: profile.role,
      }));
      return [{ ...user, profiles: ownProfiles, isAdmin: ownProfiles.some(profile => profile.role === ADMIN_ROLE) }];
    }) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function userDetails(id: string) {
  await requireAdmin();
  userId(id);
  return prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id }, select: userSelect });
    if (!user) throw new SecurityError(404, "NOT_FOUND");
    const profiles = await tx.personProfile.findMany({ where: { user_id: id }, select: profileSelect, orderBy: { pr_id: "asc" } });
    const orderCount = await tx.order.count({ where: { client_id: id } });
    const orders = await tx.order.findMany({ where: { client_id: id }, take: 10, orderBy: { order_id: "desc" }, select: { order_id: true, type: true, status: true, cr: true } });
    return { user: { ...user, profiles, isAdmin: profiles.some(profile => profile.role === ADMIN_ROLE) }, orderCount, orders };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function manageUser(request: Request, id: string) {
  const actor = await requireAdmin();
  userId(id);
  validateMutation(request);
  const parsed = managementActionSchema.safeParse(await readJson(request, 8192));
  if (!parsed.success) throw new SecurityError(422, "INVALID_INPUT");
  await enforceLimits([{ scope: "user-management", subject: actor.id, seconds: 60, maximum: 10 }], "MANAGEMENT_RATE_LIMIT");
  const { action, reason, expectedAdmin, expectedBanned } = parsed.data;
  return prisma.$transaction(async tx => {
    // Every management mutation shares this lock. READ COMMITTED reads after it
    // see the prior mutation, including actor revocation and distinct admin count.
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(84190231)`;
    const currentActor = await tx.user.findUnique({ where: { id: actor.id }, select: { bannedAt: true } });
    const actorProfile = await tx.personProfile.findFirst({ where: { user_id: actor.id, role: ADMIN_ROLE }, select: { pr_id: true } });
    if (!currentActor || currentActor.bannedAt || !actorProfile) throw new SecurityError(403, "FORBIDDEN");
    await tx.$queryRaw`SELECT "id" FROM "entity"."users" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const target = await tx.user.findUnique({ where: { id }, select: { bannedAt: true, contact: true, contactVerifiedAt: true } });
    if (!target) throw new SecurityError(404, "NOT_FOUND");
    const profiles = await tx.personProfile.findMany({ where: { user_id: id }, select: { role: true } });
    const isAdmin = profiles.some(profile => profile.role === ADMIN_ROLE);
    const banned = Boolean(target.bannedAt);
    if (actor.id === id && (action === "ban" || action === "demote")) throw new SecurityError(409, "USER_SELF_ACTION");
    if (expectedAdmin !== isAdmin || expectedBanned !== banned ||
      (action === "promote" && isAdmin) || (action === "demote" && !isAdmin) ||
      (action === "ban" && banned) || (action === "unban" && !banned)) throw new SecurityError(409, "USER_STATE_CONFLICT");
    if (action === "promote" && (banned || !target.contact || !target.contactVerifiedAt)) throw new SecurityError(422, "USER_INELIGIBLE");
    if (isAdmin && !banned && (action === "ban" || action === "demote")) {
      const remaining = await tx.$queryRaw<{ total: bigint }[]>`SELECT count(*) AS total FROM "entity"."users" u WHERE u."bannedAt" IS NULL AND EXISTS (SELECT 1 FROM "upro"."person_profile" p WHERE p."user_id" = u."id" AND p."role" = ${ADMIN_ROLE})`;
      if (Number(remaining[0]?.total ?? 0) <= 1) throw new SecurityError(409, "USER_LAST_ADMIN");
    }
    if (action === "promote") await tx.personProfile.create({ data: { user_id: id, role: ADMIN_ROLE } });
    if (action === "demote") await tx.personProfile.updateMany({ where: { user_id: id, role: ADMIN_ROLE }, data: { role: "customer" } });
    if (action === "ban" || action === "unban") {
      await tx.user.updateMany({ where: { id }, data: { bannedAt: action === "ban" ? new Date() : null } });
      // Revocation is permanent: unban never resurrects pre-ban sessions.
      await tx.session.deleteMany({ where: { userId: id } });
    }
    const previousValue = { roles: profiles.map(profile => profile.role), bannedAt: target.bannedAt?.toISOString() ?? null };
    const updated = await tx.user.findUnique({ where: { id }, select: { bannedAt: true } });
    const updatedProfiles = await tx.personProfile.findMany({ where: { user_id: id }, select: { role: true } });
    await tx.userManagementAudit.create({ data: { targetUserId: id, actorUserId: actor.id, action, reason, previousValue,
      newValue: { roles: updatedProfiles.map(profile => profile.role), bannedAt: updated?.bannedAt?.toISOString() ?? null } } });
    return { success: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
