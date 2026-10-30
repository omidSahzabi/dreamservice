import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLE, requireAdmin } from "@/lib/auth/authorization";
import { readJson, SecurityError, validateMutation } from "@/lib/security/http";
import { enforceLimits } from "@/lib/security/rate-limit";
import { projectQuery } from "@/lib/projects/diagnostics";
import { canTransitionProject, projectInputSchema, projectListSchema, projectUpdateSchema } from "@/schemas/project";

const orderSelect = { order_id: true, type: true, status: true } satisfies Prisma.OrderSelect;
export async function listProjects(request: Request) {
  await requireAdmin();
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(key => params.getAll(key).length !== 1)) throw new SecurityError(422, "INVALID_INPUT");
  const parsed = projectListSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) throw new SecurityError(422, "INVALID_INPUT");
  const { page, limit, search, status } = parsed.data;
  // Escape LIKE metacharacters so searches are literal substrings.
  const contains = search.replace(/[\\%_]/g, "\\$&");
  const where: Prisma.ProjectWhereInput = {
    ...(status ? { status } : {}),
    ...(search ? { OR: [{ title: { contains, mode: "insensitive" } }, { titleFa: { contains, mode: "insensitive" } }] } : {}),
  };
  return projectQuery("list", () => prisma.$transaction(async tx => ({
    data: await tx.project.findMany({ where, include: { order: { select: orderSelect } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit }),
    total: await tx.project.count({ where }),
  }), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }));
}

export async function saveProject(request: Request, id?: string) {
  const actor = await requireAdmin();
  if (id !== undefined && !z.string().uuid().safeParse(id).success) throw new SecurityError(422, "INVALID_INPUT");
  validateMutation(request);
  const body = await readJson(request, 65536);
  const update = id ? projectUpdateSchema.safeParse(body) : null;
  const parsed = projectInputSchema.safeParse(id ? (update?.success ? update.data.data : null) : body);
  if (!parsed.success) throw new SecurityError(422, "INVALID_INPUT");
  await enforceLimits([{ scope: "project-management", subject: actor.id, seconds: 60, maximum: 30 }], "MANAGEMENT_RATE_LIMIT");
  const data = parsed.data;
  try {
    return await prisma.$transaction(async tx => {
      // Shares the user-management lock: bans/demotions and selection serialize.
      // READ COMMITTED observes the previous holder's writes after acquiring it.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(84190231)`;
      const user = await tx.user.findUnique({ where: { id: actor.id }, select: { bannedAt: true } });
      const profile = await tx.personProfile.findFirst({ where: { user_id: actor.id, role: ADMIN_ROLE }, select: { pr_id: true } });
      if (!user || user.bannedAt || !profile) throw new SecurityError(403, "FORBIDDEN");
      const previous = id ? await tx.project.findUnique({ where: { id } }) : null;
      if (id && !previous) throw new SecurityError(404, "NOT_FOUND");
      if (previous && (!update?.success || previous.updatedAt.toISOString() !== update.data.expectedUpdatedAt)) throw new SecurityError(409, "PROJECT_CONFLICT");
      if (previous ? !canTransitionProject(previous.status, data.status) : data.status !== "PLANNED") throw new SecurityError(422, "PROJECT_TRANSITION_INVALID");
      if (data.showOnHomepage && !previous?.showOnHomepage && (!data.deadlineAt || Date.parse(data.deadlineAt) <= Date.now())) throw new SecurityError(422, "PROJECT_DEADLINE_INVALID");
      if (data.orderId !== null && !await tx.order.findUnique({ where: { order_id: data.orderId }, select: { order_id: true } })) throw new SecurityError(422, "PROJECT_ORDER_NOT_FOUND");
      if (data.showOnHomepage) {
        const selected = await tx.project.findFirst({ where: { showOnHomepage: true, ...(id ? { id: { not: id } } : {}) }, select: { id: true, updatedAt: true } });
        if (selected) await tx.project.update({ where: { id: selected.id }, data: {
          showOnHomepage: false, updatedAt: new Date(Math.max(Date.now(), selected.updatedAt.getTime() + 1)),
        } });
      }
      // No writes to orders or subscribers. No delete endpoint is provided.
      // Keep the optimistic version monotonic even for writes in one millisecond.
      const values = { ...data, startAt: data.startAt ? new Date(data.startAt) : null, deadlineAt: data.deadlineAt ? new Date(data.deadlineAt) : null,
        updatedAt: new Date(Math.max(Date.now(), (previous?.updatedAt.getTime() ?? 0) + 1)) };
      return id ? tx.project.update({ where: { id }, data: values }) : tx.project.create({ data: values });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new SecurityError(409, "PROJECT_CONFLICT");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") throw new SecurityError(422, "PROJECT_ORDER_NOT_FOUND");
    throw error;
  }
}
