import "server-only";
import { isIP } from "net";
import { prisma } from "@/lib/prisma";
import { protectedHash } from "@/lib/security/crypto";
import { SecurityError, securityEvent } from "@/lib/security/http";

type Limit = { scope: string; subject: string; seconds: number; maximum: number };

export function requestSource(request: Request) {
  // Trust only a header overwritten by an explicitly configured trusted proxy.
  const header = process.env.SECURITY_TRUSTED_IP_HEADER;
  const value = header ? request.headers.get(header) : null;
  return value && isIP(value) ? value : "unknown";
}

export async function enforceLimits(limits: Limit[]) {
  const now = Date.now();
  const denied = await prisma.$transaction(async tx => {
    for (const limit of limits) {
      const window = Math.floor(now / (limit.seconds * 1000));
      const expiresAt = new Date((window + 1) * limit.seconds * 1000);
      const key = protectedHash("rate-limit", JSON.stringify([limit.scope, limit.subject, window]));
      const bucket = await tx.securityRateLimit.upsert({
        where: { key }, create: { key, count: 1, expiresAt }, update: { count: { increment: 1 } },
      });
      if (bucket.count > limit.maximum) return Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000));
    }
    return null;
  });
  if (denied) {
    securityEvent("rate_limited");
    throw new SecurityError(429, "OTP_RATE_LIMIT", denied);
  }
}

export function otpLimits(phone: string, source: string, verification: boolean) {
  return verification ? enforceLimits([
    { scope: "verify-source", subject: source, seconds: 60, maximum: 60 },
    { scope: "verify-phone", subject: phone, seconds: 900, maximum: 30 },
  ]) : enforceLimits([
    { scope: "send-source", subject: source, seconds: 3600, maximum: 30 },
    { scope: "send-global", subject: "provider", seconds: 86400, maximum: 1000 },
    { scope: "send-phone-minute", subject: phone, seconds: 60, maximum: 1 },
    { scope: "send-phone-hour", subject: phone, seconds: 3600, maximum: 5 },
    { scope: "send-phone-day", subject: phone, seconds: 86400, maximum: 10 },
  ]);
}
