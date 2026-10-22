import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export const newSecret = () => randomBytes(32).toString("hex");
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const validSecret = (value: string | undefined): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

export class SecurityConfigurationError extends Error {}

export function protectedHash(context: string, value: string) {
  const key = process.env.SECURITY_OTP_KEY;
  if (!key || Buffer.byteLength(key) < 32) throw new SecurityConfigurationError("Security configuration unavailable");
  return createHmac("sha256", key).update(JSON.stringify([context, value])).digest("hex");
}

export function equalDigest(left: string, right: string) {
  return validSecret(left) && validSecret(right) && timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
