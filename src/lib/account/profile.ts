import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SecurityError } from "@/lib/security/http";

export async function usernameSupported(tx: Prisma.TransactionClient = prisma) {
  const rows = await tx.$queryRaw<{ supported: boolean }[]>`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'entity' AND table_name = 'users' AND column_name = 'username') AS supported`;
  return rows[0]?.supported === true;
}

export async function readUsername(id: string) {
  // JSON lookup is compatible with the pre-migration table too. Legacy sessions
  // and registration without a username continue working at the approval gate.
  const rows = await prisma.$queryRaw<{ username: string | null }[]>`SELECT to_jsonb(u)->>'username' AS username FROM entity.users u WHERE id = ${id}::uuid`;
  return rows[0]?.username ?? null;
}

export async function requireUsernameSupport(tx: Prisma.TransactionClient = prisma) {
  if (!await usernameSupported(tx)) throw new SecurityError(503, "ACCOUNT_PROFILE_UNAVAILABLE");
}

export function registrationConflict(error: unknown): SecurityError | null {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") return null;
  const meta = "meta" in error && error.meta && typeof error.meta === "object" ? error.meta : null;
  const target = meta && "target" in meta ? meta.target : undefined;
  const fields = Array.isArray(target) ? target.filter((item): item is string => typeof item === "string").join(" ") : typeof target === "string" ? target : "";
  return new SecurityError(409, fields.includes("username") ? "USERNAME_TAKEN" : "REGISTRATION_CONFLICT");
}
