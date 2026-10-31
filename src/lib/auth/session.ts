import "server-only";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { digest, newSecret, validSecret } from "@/lib/security/crypto";
import { SecurityError } from "@/lib/security/http";
import {previewLoginConfig, previewStoredToken, PREVIEW_SESSION_SECONDS} from "@/lib/auth/preview-config";
import {temporaryAdminLoginConfig, temporaryAdminStoredToken, TEMP_ADMIN_SESSION_SECONDS, TEMP_ADMIN_TOKEN_PREFIX} from "@/lib/auth/temporary-admin-config";
import {normalizePhone} from "@/lib/auth/helper";

export const SESSION_COOKIE_NAME = "dream_session";
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export const cookieOptions = (seconds: number) => ({
  httpOnly: true, secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const, path: "/", maxAge: seconds,
});
export const generateSessionToken = newSecret;
export const storedToken = (token: string) => "sha256:" + digest(token);

function acceptedTokens(token: string) {
  const preview = previewLoginConfig();
  const temporary = temporaryAdminLoginConfig();
  return [storedToken(token), token, ...(preview ? [previewStoredToken(token, preview)] : []), ...(temporary ? [temporaryAdminStoredToken(token, temporary)] : [])];
}

export async function insertSession(tx: Prisma.TransactionClient, userId: string, previous?: string, preview?: {scope: string; kind?: "temporary-admin"}) {
  // Serialize session establishment with bans; read after acquiring the lock.
  await tx.$queryRaw`SELECT "id" FROM "entity"."users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: userId }, select: { bannedAt: true, contact: true } });
  if (!user || user.bannedAt) throw new SecurityError(403, "ACCOUNT_BANNED");
  const temporary = preview?.kind === "temporary-admin";
  const temporaryConfig = temporary ? temporaryAdminLoginConfig() : null;
  const previewConfig = preview && !temporary ? previewLoginConfig() : null;
  const config = temporaryConfig ?? previewConfig;
  const failure = temporary ? "TEMP_ADMIN_LOGIN_FAILED" : "PREVIEW_LOGIN_FAILED";
  if (preview && (!config || config.scope !== preview.scope)) throw new SecurityError(401, failure);
  if (temporary) {
    const current = temporaryAdminLoginConfig();
    let phone: string | null = null;
    try { phone = normalizePhone(user.contact); } catch { /* Deny malformed identities. */ }
    const profiles = await tx.personProfile.findMany({where: {user_id: userId, role: "app-admin"}, select: {user_id: true, role: true}});
    if (!current || current.scope !== preview?.scope || phone !== current.phone || !profiles.some(profile => profile.user_id === userId && profile.role === "app-admin")) throw new SecurityError(401, failure);
  }
  const seconds = config ? Math.min(temporary ? TEMP_ADMIN_SESSION_SECONDS : PREVIEW_SESSION_SECONDS, Math.floor((config.expiresAt - Date.now()) / 1000)) : SESSION_SECONDS;
  if (seconds < 1) throw new SecurityError(401, failure);
  const token = newSecret();
  const savedToken = temporaryConfig ? temporaryAdminStoredToken(token, temporaryConfig) : previewConfig ? previewStoredToken(token, previewConfig) : storedToken(token);
  await tx.session.create({ data: { userId, token: savedToken, expiresAt: new Date(Date.now() + seconds * 1000) } });
  if (validSecret(previous)) await tx.session.deleteMany({ where: { token: { in: acceptedTokens(previous) } } });
  return token;
}

export async function setSessionCookie(token: string, seconds = SESSION_SECONDS) {
  (await cookies()).set(SESSION_COOKIE_NAME, token, { ...cookieOptions(seconds), expires: new Date(Date.now() + seconds * 1000) });
}

export async function createSession(userId: string) {
  const previous = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const token = await prisma.$transaction(tx => insertSession(tx, userId, previous));
  await setSessionCookie(token);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!validSecret(token)) return null;
  // Legacy raw tokens remain valid until their original expiry; no data rewrite.
  const session = await prisma.session.findFirst({
    where: { token: { in: acceptedTokens(token) }, expiresAt: { gt: new Date() } },
    include: { user: { select: { id: true, fname: true, lname: true, contact: true, email: true, bannedAt: true } } },
  });
  if (!session || session.user.bannedAt) return null;
  const profiles = await prisma.personProfile.findMany({ where: { user_id: session.user.id }, select: { user_id: true, role: true } });
  const roles = [...new Set(profiles.flatMap(profile => profile.user_id === session.user.id && profile.role ? [profile.role] : []))];
  if (session.token.startsWith(TEMP_ADMIN_TOKEN_PREFIX)) {
    const config = temporaryAdminLoginConfig();
    let phone: string | null = null;
    try { phone = normalizePhone(session.user.contact); } catch { /* Fail closed. */ }
    if (!config || phone !== config.phone || !roles.includes("app-admin")) return null;
  }
  return { ...session.user, roles };
}

export async function invalidateSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  const proof = jar.get("dream_registration")?.value;
  const binding = jar.get("dream_auth_binding")?.value;
  const challenge = z.string().uuid().safeParse(jar.get("dream_otp_challenge")?.value);
  try {
    if (validSecret(token) || (validSecret(binding) && (validSecret(proof) || challenge.success))) {
      await prisma.$transaction(async tx => {
        if (validSecret(token)) await tx.session.deleteMany({ where: { token: { in: acceptedTokens(token) } } });
        if (validSecret(proof) && validSecret(binding)) await tx.registrationGrant.updateMany({ where: { tokenHash: digest(proof), browserBindingHash: digest(binding), consumedAt: null }, data: { consumedAt: new Date() } });
        if (challenge.success && validSecret(binding)) await tx.otpVerification.updateMany({ where: { id: challenge.data, browserBindingHash: digest(binding), consumedAt: null }, data: { consumedAt: new Date() } });
      });
    }
  } finally {
    jar.set(SESSION_COOKIE_NAME, "", { ...cookieOptions(0), expires: new Date(0) });
    for (const name of ["dream_auth_binding", "dream_otp_challenge", "dream_registration"]) {
      jar.set(name, "", { ...cookieOptions(0), expires: new Date(0) });
    }
  }
}
