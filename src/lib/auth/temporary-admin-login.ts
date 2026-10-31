import "server-only";
import {cookies} from "next/headers";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {normalizePhone} from "@/lib/auth/helper";
import {phoneAccount} from "@/lib/auth/phone-account";
import {temporaryAdminLoginConfig, TEMP_ADMIN_SESSION_SECONDS} from "@/lib/auth/temporary-admin-config";
import {verifyPreviewPassword as verifyPassword} from "@/lib/auth/preview-password";
import {insertSession, SESSION_COOKIE_NAME, setSessionCookie} from "@/lib/auth/session";
import {enforceLimits, requestSource} from "@/lib/security/rate-limit";
import {readJson, SecurityError, securityEvent, validateMutation} from "@/lib/security/http";

const credentials = z.object({phone: z.string().min(1).max(64), password: z.string().min(1).max(128)}).strict();
const denied = () => new SecurityError(401, "TEMP_ADMIN_LOGIN_FAILED");

export async function temporaryAdminPasswordLogin(request: Request) {
  validateMutation(request);
  const config = temporaryAdminLoginConfig();
  if (!config) throw denied();
  const source = requestSource(request);
  if (source === "unknown") throw denied();
  await enforceLimits([
    {scope: "temporary-admin-ip-minute", subject: source, seconds: 60, maximum: 5},
    {scope: "temporary-admin-ip", subject: source, seconds: 900, maximum: 10},
    {scope: "temporary-admin-global", subject: "temporary-admin", seconds: 900, maximum: 30},
  ], "TEMP_ADMIN_LOGIN_FAILED");
  let body: unknown;
  try { body = await readJson(request, 2048); } catch { throw denied(); }
  const parsed = credentials.safeParse(body);
  if (!parsed.success) throw denied();
  let phone: string | null = null;
  try { phone = normalizePhone(parsed.data.phone); } catch { /* Generic credential error. */ }
  await enforceLimits([{scope: "temporary-admin-phone", subject: phone ?? "invalid", seconds: 900, maximum: 10}], "TEMP_ADMIN_LOGIN_FAILED");
  // Equal-cost verification for every validly shaped credential submission.
  const matches = await verifyPassword(parsed.data.password, config.hash);
  if (!matches || phone !== config.phone) throw denied();
  const previous = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const token = await prisma.$transaction(async tx => {
    const account = await phoneAccount(tx, phone);
    if (!account || account.bannedAt) throw denied();
    try { return await insertSession(tx, account.id, previous, {scope: config.scope, kind: "temporary-admin"}); }
    catch (error) {
      if (error instanceof SecurityError && error.code === "ACCOUNT_BANNED") throw denied();
      throw error;
    }
  });
  const current = temporaryAdminLoginConfig();
  if (!current || current.scope !== config.scope) throw denied();
  await setSessionCookie(token, Math.min(TEMP_ADMIN_SESSION_SECONDS, Math.max(1, Math.floor((current.expiresAt - Date.now()) / 1000))));
  securityEvent("temporary_admin_login_succeeded");
  return {success: true as const};
}
