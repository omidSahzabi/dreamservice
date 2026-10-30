import "server-only";
import {digest} from "@/lib/security/crypto";
import {normalizePhone} from "@/lib/auth/helper";

export const PREVIEW_SESSION_SECONDS = 60 * 60;
export const PREVIEW_TOKEN_PREFIX = "preview-password:";

export type PreviewLoginConfig = {
  hash: string;
  phones: ReadonlySet<string>;
  expiresAt: number;
  scope: string;
};

export function previewLoginConfig(): PreviewLoginConfig | null {
  if (process.env.PREVIEW_PASSWORD_LOGIN_ENABLED !== "true" || process.env.VERCEL_ENV !== "preview") return null;
  const hash = process.env.PREVIEW_PASSWORD_LOGIN_HASH ?? "";
  if (!/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(hash)) return null;
  const raw = process.env.PREVIEW_PASSWORD_LOGIN_PHONES ?? "";
  if (raw.length > 256) return null;
  const numbers = raw.split(",");
  if (!numbers.length || numbers.length > 3) return null;
  let phones: Set<string>;
  try { phones = new Set(numbers.map(phone => normalizePhone(phone.trim()))); }
  catch { return null; }
  const expiry = process.env.PREVIEW_PASSWORD_LOGIN_EXPIRES_AT ?? "";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(expiry)) return null;
  const expiresAt = Date.parse(expiry);
  if (!Number.isFinite(expiresAt) || new Date(expiresAt).toISOString() !== expiry || expiresAt <= Date.now() || expiresAt > Date.now() + 7 * 86400000) return null;
  const origin = process.env.SECURITY_ORIGIN;
  if (!origin) return null;
  return {hash, phones, expiresAt, scope: digest(JSON.stringify([hash, [...phones].sort(), expiry, origin]))};
}

export function previewStoredToken(token: string, config: PreviewLoginConfig) {
  return PREVIEW_TOKEN_PREFIX + config.scope + ":sha256:" + digest(token);
}
