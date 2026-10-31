import "server-only";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { OtpPurpose } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateOtpCode, normalizePhone } from "@/lib/auth/helper";
import { sendOtpSms } from "@/lib/auth/sms";
import { cookieOptions, insertSession, SESSION_COOKIE_NAME, setSessionCookie } from "@/lib/auth/session";
import { digest, equalDigest, newSecret, protectedHash, validSecret } from "@/lib/security/crypto";
import { otpOperation, readJson, SecurityError, securityEvent, validateMutation } from "@/lib/security/http";
import { otpLimits, requestSource } from "@/lib/security/rate-limit";
import type { ApiErrorCode } from "@/lib/api/errors";
import { phoneAccount } from "@/lib/auth/phone-account";

export const BINDING_COOKIE = "dream_auth_binding";
export const CHALLENGE_COOKIE = "dream_otp_challenge";
export const GRANT_COOKIE = "dream_registration";
export const OTP_SECONDS = 120;
export const GRANT_SECONDS = 600;
export const MAX_ATTEMPTS = 5;
const requestSchema = z.object({ target: z.string().min(1).max(64), purpose: z.nativeEnum(OtpPurpose).default("LOGIN") }).strict();
const verifySchema = requestSchema.extend({ code: z.string().regex(/^\d{5}$/) });
const otpHash = (id: string, phone: string, purpose: OtpPurpose, code: string) => protectedHash("otp-v1", JSON.stringify([id, phone, purpose, code]));
type VerifyOutcome = { error: ApiErrorCode; status: number } | { isNewUser: false; token: string } | { isNewUser: true; grant: string };

function phoneNumber(value: string) {
  try { return normalizePhone(value); } catch { throw new SecurityError(400, "INVALID_PHONE"); }
}

export async function requestOtp(request: Request) {
  validateMutation(request);
  const parsed = requestSchema.safeParse(await readJson(request, 2048));
  if (!parsed.success) throw new SecurityError(422, "INVALID_INPUT");
  const phone = phoneNumber(parsed.data.target);
  const purpose = parsed.data.purpose;
  const consoleDelivery = process.env.OTP_DELIVERY_MODE === "console";
  if (consoleDelivery && process.env.NODE_ENV !== "development") throw new SecurityError(503, "SMS_FAILED");
  await otpOperation("rate_limit", () => otpLimits(phone, requestSource(request), false));
  const account = await phoneAccount(prisma, phone);
  if (account?.bannedAt) throw new SecurityError(403, "ACCOUNT_BANNED");
  const jar = await otpOperation("cookie_access", () => cookies());
  const oldBinding = jar.get(BINDING_COOKIE)?.value;
  const binding = validSecret(oldBinding) ? oldBinding : newSecret();
  const id = randomUUID();
  const code = generateOtpCode();
  const codeHash = await otpOperation("challenge_hash", () => otpHash(id, phone, purpose, code));
  await otpOperation("challenge_persistence", () => prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${phone}, 0))`;
    const latest = await tx.otpVerification.findFirst({ where: { target: phone, channel: "PHONE" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    if (latest && Date.now() - latest.createdAt.getTime() < 60000) throw new SecurityError(429, "OTP_RATE_LIMIT", 60);
    await tx.otpVerification.updateMany({ where: { target: phone, channel: "PHONE", consumedAt: null }, data: { consumedAt: new Date() } });
    await tx.otpVerification.create({ data: { id, target: phone, channel: "PHONE", purpose, codeHash, browserBindingHash: digest(binding), deliveryState: "PENDING", expiresAt: new Date(Date.now() + OTP_SECONDS * 1000) } });
  }));
  const result = consoleDelivery ? { success: true } : await otpOperation("sms_delivery", () => sendOtpSms({ to: phone, code }));
  const delivered = await otpOperation("delivery_state_persistence", () => prisma.otpVerification.updateMany({
    where: { id, consumedAt: null, deliveryState: "PENDING", expiresAt: { gt: new Date() } },
    data: { deliveryState: result.success ? "SENT" : "FAILED" },
  }));
  if (!result.success || delivered.count !== 1) {
    if (delivered.count !== 1) console.warn(JSON.stringify({event: "otp_delivery_state_not_updated", category: "delivery_compare_and_set_miss", providerAccepted: result.success}));
    securityEvent("sms_failed");
    throw new SecurityError(502, "SMS_FAILED");
  }
  jar.set(BINDING_COOKIE, binding, cookieOptions(GRANT_SECONDS));
  jar.set(CHALLENGE_COOKIE, id, cookieOptions(OTP_SECONDS));
  if (consoleDelivery) console.info("[development OTP] phone=%s code=%s", phone, code);
  return { success: true, expiresIn: OTP_SECONDS, retryAfter: 60 };
}

export async function verifyOtpRequest(request: Request) {
  validateMutation(request);
  const parsed = verifySchema.safeParse(await readJson(request, 2048));
  if (!parsed.success) throw new SecurityError(422, "INVALID_INPUT");
  const { code, purpose } = parsed.data;
  const phone = phoneNumber(parsed.data.target);
  await otpLimits(phone, requestSource(request), true);
  const jar = await cookies();
  const binding = jar.get(BINDING_COOKIE)?.value;
  const challengeId = jar.get(CHALLENGE_COOKIE)?.value;
  if (!validSecret(binding) || !z.string().uuid().safeParse(challengeId).success) throw new SecurityError(400, "OTP_INVALID");
  const browserBindingHash = digest(binding);
  const outcome = await prisma.$transaction<VerifyOutcome>(async tx => {
    const otp = await tx.otpVerification.findUnique({ where: { id: challengeId } });
    if (!otp || otp.target !== phone || otp.channel !== "PHONE" || otp.purpose !== purpose || otp.browserBindingHash !== browserBindingHash || otp.deliveryState !== "SENT") return { error: "OTP_INVALID" as const, status: 400 };
    if (otp.consumedAt) return { error: "OTP_USED" as const, status: 400 };
    if (otp.expiresAt <= new Date()) return { error: "OTP_EXPIRED" as const, status: 400 };
    const reservation = await tx.otpVerification.updateMany({
      where: { id: otp.id, attempts: { lt: MAX_ATTEMPTS }, consumedAt: null, expiresAt: { gt: new Date() }, deliveryState: "SENT" },
      data: { attempts: { increment: 1 } },
    });
    if (!reservation.count) return { error: "OTP_ATTEMPTS_EXCEEDED" as const, status: 429 };
    if (!equalDigest(otp.codeHash, otpHash(otp.id, phone, purpose, code))) return { error: "OTP_INVALID" as const, status: 400 };
    const consumed = await tx.otpVerification.updateMany({ where: { id: otp.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
    if (!consumed.count) return { error: "OTP_USED" as const, status: 400 };
    const user = await phoneAccount(tx, phone);
    if (user) {
      if (purpose !== "LOGIN") return { error: "OTP_INVALID" as const, status: 400 };
      await tx.user.updateMany({where: {id: user.id}, data: {contactVerifiedAt: new Date()}});
      const token = await insertSession(tx, user.id, jar.get(SESSION_COOKIE_NAME)?.value);
      return { isNewUser: false as const, token };
    }
    // LOGIN is the unified UI flow; an unknown verified phone advances to REGISTER.
    const grant = newSecret();
    await tx.registrationGrant.updateMany({ where: { phone, browserBindingHash, consumedAt: null }, data: { consumedAt: new Date() } });
    await tx.registrationGrant.create({ data: { tokenHash: digest(grant), phone, browserBindingHash, purpose: "REGISTER", expiresAt: new Date(Date.now() + GRANT_SECONDS * 1000) } });
    return { isNewUser: true as const, grant };
  });
  if ("error" in outcome) throw new SecurityError(outcome.status, outcome.error);
  jar.set(CHALLENGE_COOKIE, "", cookieOptions(0));
  if (outcome.isNewUser) jar.set(GRANT_COOKIE, outcome.grant, cookieOptions(GRANT_SECONDS));
  else {
    await setSessionCookie(outcome.token);
    jar.set(GRANT_COOKIE, "", cookieOptions(0));
    securityEvent("auth_succeeded");
  }
  return { success: true, verified: true, isNewUser: outcome.isNewUser };
}
