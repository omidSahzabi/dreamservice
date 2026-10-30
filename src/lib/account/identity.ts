import { z } from "zod";

export const reservedUsernames = ["admin", "administrator", "support", "api", "root", "dreamservice"] as const;

// Whole normalized tokens, never arbitrary substrings. Keep additions reviewed
// for personal-name false positives; see docs/v1-phase1-fixes.md.
export const forbiddenIdentityTerms = [
  "fuck", "fucker", "motherfucker", "shit", "bitch", "cunt",
  "کیر", "کص", "کسکش", "کونی", "جاکش",
] as const;

export function normalizeForModeration(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[يك]/g, character => character === "ي" ? "ی" : "ک")
    .replace(/[\u064b-\u065f\u0670\u0640\u200c\u200d]/g, "");
}

export function prohibitedIdentity(value: string) {
  const tokens = normalizeForModeration(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return tokens.some(token => forbiddenIdentityTerms.some(term => token === normalizeForModeration(term)));
}

export const usernameSchema = z.string().trim().transform(value => value.toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9_]{3,30}$/, "USERNAME_INVALID"))
  .refine(value => !reservedUsernames.some(name => name === value), "USERNAME_RESERVED")
  .refine(value => !prohibitedIdentity(value), "NAME_PROHIBITED");

export const optionalUsernameSchema = z.union([z.literal(""), usernameSchema]).optional().nullable()
  .transform(value => value || null);

export const personalNameSchema = z.string().trim().min(2).max(100)
  .refine(value => !prohibitedIdentity(value), "NAME_PROHIBITED");

// Return plain presentation text only. Ownership/permissions always use UUIDs.
// Callers must render as text, never inject this result as HTML.
export function publicDisplayName(person: { fname?: string | null; lname?: string | null; username?: string | null }, fallback: string) {
  const names = [person.fname, person.lname].filter((value): value is string => Boolean(value?.trim()));
  if (names.length && names.every(name => personalNameSchema.safeParse(name).success && !/[\u0000-\u001f\u007f]/.test(name))) return names.map(name => name.trim()).join(" ");
  const username = usernameSchema.safeParse(person.username);
  return username.success ? username.data : fallback;
}
