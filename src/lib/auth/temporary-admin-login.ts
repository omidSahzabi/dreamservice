import "server-only";
import {cookies} from "next/headers";
import {z} from "zod";
import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import {normalizePhone} from "@/lib/auth/helper";
import {phoneAccount} from "@/lib/auth/phone-account";
import {temporaryAdminLoginConfig, TEMP_ADMIN_SESSION_SECONDS} from "@/lib/auth/temporary-admin-config";
import {verifyPreviewPassword as verifyPassword} from "@/lib/auth/preview-password";
import {insertSession, SESSION_COOKIE_NAME, setSessionCookie} from "@/lib/auth/session";
import {enforceLimits, requestSource} from "@/lib/security/rate-limit";
import {readJson, SecurityError, securityEvent, validateMutation} from "@/lib/security/http";
import {SecurityConfigurationError} from "@/lib/security/crypto";

const credentials = z.object({phone: z.string().min(1).max(64), password: z.string().min(1).max(128)}).strict();
const denied = () => new SecurityError(401, "TEMP_ADMIN_LOGIN_FAILED");

export async function temporaryAdminPasswordLogin(request: Request) {
  let stage = "configuration";
  try {
    validateMutation(request);
    const config = temporaryAdminLoginConfig();
    if (!config) throw denied();
    const source = requestSource(request);
    if (source === "unknown") throw denied();
    stage = "source_rate_limit";
    await enforceLimits([
      {scope: "temporary-admin-ip-minute", subject: source, seconds: 60, maximum: 5},
      {scope: "temporary-admin-ip", subject: source, seconds: 900, maximum: 10},
      {scope: "temporary-admin-global", subject: "temporary-admin", seconds: 900, maximum: 30},
    ], "TEMP_ADMIN_LOGIN_FAILED");
    stage = "request_validation";
    let body: unknown;
    try { body = await readJson(request, 2048); } catch { throw denied(); }
    const parsed = credentials.safeParse(body);
    if (!parsed.success) throw denied();
    let phone: string | null = null;
    try { phone = normalizePhone(parsed.data.phone); } catch { /* Generic credential error. */ }
    stage = "phone_rate_limit";
    await enforceLimits([{scope: "temporary-admin-phone", subject: phone ?? "invalid", seconds: 900, maximum: 10}], "TEMP_ADMIN_LOGIN_FAILED");
    // Equal-cost verification for every validly shaped credential submission.
    stage = "password_verification";
    const matches = await verifyPassword(parsed.data.password, config.hash);
    if (!matches || phone !== config.phone) throw denied();
    stage = "cookie_read";
    const previous = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    stage = "transaction_start";
    const token = await prisma.$transaction(async tx => {
      stage = "account_lookup";
      const account = await phoneAccount(tx, phone);
      if (!account || account.bannedAt) throw denied();
      stage = "session_creation";
      try {
        const inserted = await insertSession(tx, account.id, previous, {scope: config.scope, kind: "temporary-admin"});
        stage = "transaction_commit";
        return inserted;
      }
      catch (error) {
        if (error instanceof SecurityError && error.code === "ACCOUNT_BANNED") throw denied();
        throw error;
      }
    });
    stage = "configuration_recheck";
    const current = temporaryAdminLoginConfig();
    if (!current || current.scope !== config.scope) throw denied();
    stage = "cookie_write";
    await setSessionCookie(token, Math.min(TEMP_ADMIN_SESSION_SECONDS, Math.max(1, Math.floor((current.expiresAt - Date.now()) / 1000))));
    stage = "success_audit";
    securityEvent("temporary_admin_login_succeeded");
    return {success: true as const};
  } catch (error) {
    if (!(error instanceof SecurityError)) {
      const category = error instanceof SecurityConfigurationError ? "security_key_configuration" :
        error instanceof Prisma.PrismaClientInitializationError ? "database_initialization" :
        error instanceof Prisma.PrismaClientKnownRequestError ? "database_query" :
        error instanceof Prisma.PrismaClientValidationError ? "prisma_validation" :
        error instanceof Prisma.PrismaClientUnknownRequestError ? "database_unknown" : "unexpected";
      const code = error instanceof Prisma.PrismaClientKnownRequestError && /^P\d{4}$/.test(error.code) ? error.code : undefined;
      // Only fixed categories/stages and validated Prisma codes; never error text,
      // stacks, metadata, request data or credential/configuration values.
      console.warn(JSON.stringify({event: "temporary_admin_login_operation_failed", stage, category, ...(code ? {code} : {})}));
    }
    throw error;
  }
}
