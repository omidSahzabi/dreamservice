import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizePhone, normalizeEmail } from "@/lib/auth/helper";
import { BINDING_COOKIE, GRANT_COOKIE } from "@/lib/auth/otp";
import { cookieOptions, insertSession, SESSION_COOKIE_NAME, setSessionCookie } from "@/lib/auth/session";
import { digest, validSecret } from "@/lib/security/crypto";
import { privateJson, readJson, SecurityError, securityEvent, securityFailure, validateMutation } from "@/lib/security/http";
import { enforceLimits, requestSource } from "@/lib/security/rate-limit";
import { optionalUsernameSchema, personalNameSchema } from "@/lib/account/identity";
import { registrationConflict, requireUsernameSupport } from "@/lib/account/profile";
import { phoneAccount } from "@/lib/auth/phone-account";

const schema = z.object({ contact: z.string().min(1).max(64), fname: personalNameSchema, lname: personalNameSchema, username: optionalUsernameSchema, email: z.union([z.string().email().max(254), z.literal("")]).optional() }).strict();

export async function POST(request: Request) {
  try {
    validateMutation(request);
    const parsed = schema.safeParse(await readJson(request, 4096));
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message;
      throw new SecurityError(422, message === "NAME_PROHIBITED" || message === "USERNAME_INVALID" || message === "USERNAME_RESERVED" ? message : "INVALID_INPUT");
    }
    let phone: string;
    try { phone = normalizePhone(parsed.data.contact); } catch { throw new SecurityError(400, "INVALID_PHONE"); }
    await enforceLimits([{ scope: "register-source", subject: requestSource(request), seconds: 900, maximum: 20 }]);
    const jar = await cookies();
    const proof = jar.get(GRANT_COOKIE)?.value;
    const binding = jar.get(BINDING_COOKIE)?.value;
    if (!validSecret(proof) || !validSecret(binding)) throw new SecurityError(403, "REGISTRATION_EXPIRED");
    const token = await prisma.$transaction(async tx => {
      if (parsed.data.username) await requireUsernameSupport(tx);
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${phone}, 0))`;
      const consumed = await tx.registrationGrant.updateMany({
        where: { tokenHash: digest(proof), browserBindingHash: digest(binding), phone, purpose: "REGISTER", consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) throw new SecurityError(403, "REGISTRATION_EXPIRED");
      if (await phoneAccount(tx, phone)) throw new SecurityError(409, "REGISTRATION_CONFLICT");
      const user = await tx.user.create({ data: { contact: phone, contactVerifiedAt: new Date(), fname: parsed.data.fname, lname: parsed.data.lname, ...(parsed.data.username ? { username: parsed.data.username } : {}), email: parsed.data.email ? normalizeEmail(parsed.data.email) : null }, select: { id: true } });
      return insertSession(tx, user.id, jar.get(SESSION_COOKIE_NAME)?.value);
    });
    await setSessionCookie(token);
    jar.set(GRANT_COOKIE, "", cookieOptions(0));
    securityEvent("auth_succeeded");
    return privateJson({ success: true });
  } catch (error) { return securityFailure(registrationConflict(error) ?? error, "REGISTER_FAILED"); }
}
