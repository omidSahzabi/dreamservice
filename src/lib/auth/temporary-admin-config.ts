import "server-only";
import {digest} from "@/lib/security/crypto";
import {normalizePhone} from "@/lib/auth/helper";
import {isTemporaryAdminPhone} from "@/lib/auth/temporary-admin-phone";

export const TEMP_ADMIN_SESSION_SECONDS = 60 * 60;
export const TEMP_ADMIN_TOKEN_PREFIX = "temporary-admin-password:";
export type TemporaryAdminConfig = {hash: string; phone: string; expiresAt: number; scope: string};

export function temporaryAdminLoginConfig(): TemporaryAdminConfig | null {
  if (process.env.TEMP_ADMIN_LOGIN_ENABLED !== "true" || process.env.VERCEL_ENV !== "production" || process.env.NODE_ENV !== "production") return null;
  const hash = process.env.TEMP_ADMIN_LOGIN_HASH ?? "";
  if (!/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(hash)) return null;
  let phone: string;
  try { phone = normalizePhone(process.env.TEMP_ADMIN_LOGIN_PHONE); }
  catch { return null; }
  if (!isTemporaryAdminPhone(phone)) return null;
  const start = process.env.TEMP_ADMIN_LOGIN_STARTED_AT ?? "";
  const end = process.env.TEMP_ADMIN_LOGIN_EXPIRES_AT ?? "";
  const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/;
  if (!timestamp.test(start) || !timestamp.test(end)) return null;
  const startsAt = Date.parse(start), expiresAt = Date.parse(end), now = Date.now();
  if (!Number.isFinite(startsAt) || !Number.isFinite(expiresAt) || new Date(startsAt).toISOString() !== start || new Date(expiresAt).toISOString() !== end || startsAt > now || expiresAt <= now || expiresAt <= startsAt || expiresAt - startsAt > 48 * 60 * 60 * 1000) return null;
  const origin = process.env.SECURITY_ORIGIN;
  const sourceHeader = process.env.SECURITY_TRUSTED_IP_HEADER;
  if (!origin || !sourceHeader) return null;
  try { if (new URL(origin).origin !== origin || new URL(origin).protocol !== "https:") return null; }
  catch { return null; }
  return {hash, phone, expiresAt, scope: digest(JSON.stringify([hash, phone, start, end, origin, sourceHeader]))};
}

export function temporaryAdminStoredToken(token: string, config: TemporaryAdminConfig) {
  return TEMP_ADMIN_TOKEN_PREFIX + config.scope + ":sha256:" + digest(token);
}
