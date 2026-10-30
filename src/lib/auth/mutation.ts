import "server-only";
import type { Prisma } from "@prisma/client";
import { ADMIN_ROLE, type Principal } from "@/lib/auth/authorization";
import { SecurityError } from "@/lib/security/http";

// Lock order: management shared lock, actor row, then resource rows.
// Management takes the exclusive advisory lock before locking any user row.
export async function authorizeMutation(tx: Prisma.TransactionClient, actor: Principal, admin = false) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock_shared(84190231)`;
  await tx.$queryRaw`SELECT "id" FROM "entity"."users" WHERE "id" = ${actor.id}::uuid FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { bannedAt: true } });
  if (!user || user.bannedAt) throw new SecurityError(401, "UNAUTHENTICATED");
  if (admin && !await tx.personProfile.findFirst({ where: { user_id: actor.id, role: ADMIN_ROLE }, select: { pr_id: true } })) {
    throw new SecurityError(403, "FORBIDDEN");
  }
}
