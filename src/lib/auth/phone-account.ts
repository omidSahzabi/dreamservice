import "server-only";
import type { Prisma } from "@prisma/client";
import { usernameSupported } from "@/lib/account/profile";

export async function phoneAccount(tx: Prisma.TransactionClient, phone: string) {
  const exact = await tx.user.findUnique({ where: { contact: phone }, select: { id: true, bannedAt: true } });
  if (exact || !await usernameSupported(tx)) return exact;
  // The additive identity migration creates this immutable normalization
  // function atomically with username. Never rewrite a legacy contact value.
  const rows = await tx.$queryRaw<{ id: string; bannedAt: Date | null }[]>`SELECT id, "bannedAt" FROM entity.users WHERE entity.canonical_iran_mobile(contact) = ${phone}`;
  return rows[0] ?? null;
}
