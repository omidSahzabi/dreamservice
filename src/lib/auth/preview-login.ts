import "server-only";
import {cookies} from "next/headers";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {normalizePhone} from "@/lib/auth/helper";
import {phoneAccount} from "@/lib/auth/phone-account";
import {previewLoginConfig, PREVIEW_SESSION_SECONDS} from "@/lib/auth/preview-config";
import {verifyPreviewPassword} from "@/lib/auth/preview-password";
import {insertSession, SESSION_COOKIE_NAME, setSessionCookie} from "@/lib/auth/session";
import {enforceLimits, requestSource} from "@/lib/security/rate-limit";
import {readJson, SecurityError, securityEvent, validateMutation} from "@/lib/security/http";

const schema = z.object({phone: z.string().min(1).max(64), password: z.string().min(1).max(128)}).strict();
const denied = () => new SecurityError(401, "PREVIEW_LOGIN_FAILED");

export async function previewPasswordLogin(request: Request) {
  validateMutation(request);
  const config = previewLoginConfig();
  if (!config) throw denied();
  const source = requestSource(request);
  // No fallback to attacker-controlled forwarding headers or unmetered sources.
  if (source === "unknown") throw denied();
  await enforceLimits([
    {scope: "preview-login-ip-minute", subject: source, seconds: 60, maximum: 5},
    {scope: "preview-login-ip", subject: source, seconds: 900, maximum: 10},
    {scope: "preview-login-global", subject: "preview", seconds: 900, maximum: 30},
  ], "PREVIEW_LOGIN_FAILED");
  let body: unknown;
  try { body = await readJson(request, 2048); } catch { throw denied(); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw denied();
  let phone: string | null = null;
  try { phone = normalizePhone(parsed.data.phone); } catch { /* Same credential error. */ }
  await enforceLimits([{scope: "preview-login-phone", subject: phone ?? "invalid", seconds: 900, maximum: 5}], "PREVIEW_LOGIN_FAILED");
  // Do the same expensive password verification before the allowlist decision.
  const matches = await verifyPreviewPassword(parsed.data.password, config.hash);
  if (!matches || !phone || !config.phones.has(phone)) throw denied();
  const previous = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const token = await prisma.$transaction(async tx => {
    const account = await phoneAccount(tx, phone);
    if (!account || account.bannedAt) throw denied();
    try { return await insertSession(tx, account.id, previous, {scope: config.scope}); }
    catch (error) {
      if (error instanceof SecurityError && error.code === "ACCOUNT_BANNED") throw denied();
      throw error;
    }
  });
  await setSessionCookie(token, Math.min(PREVIEW_SESSION_SECONDS, Math.max(1, Math.floor((config.expiresAt - Date.now()) / 1000))));
  securityEvent("auth_succeeded");
  return {success: true as const};
}
