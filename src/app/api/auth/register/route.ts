import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizePhone, normalizeEmail } from "@/lib/auth/helper";
import { BINDING_COOKIE, GRANT_COOKIE } from "@/lib/auth/otp";
import { cookieOptions, insertSession, SESSION_COOKIE_NAME, setSessionCookie } from "@/lib/auth/session";
import { digest, validSecret } from "@/lib/security/crypto";
import { privateJson, readJson, SecurityError, securityEvent, securityFailure, validateMutation } from "@/lib/security/http";
import { enforceLimits, requestSource } from "@/lib/security/rate-limit";

const schema = z.object({ contact: z.string().min(1).max(64), fname: z.string().trim().min(2).max(100), lname: z.string().trim().min(2).max(100), email: z.union([z.string().email().max(254), z.literal("")]).optional() }).strict();

export async function POST(request: Request) {
  try {
    validateMutation(request);
    const parsed = schema.safeParse(await readJson(request, 4096));
    if (!parsed.success) throw new SecurityError(422, "INVALID_INPUT");
    let phone: string;
    try { phone = normalizePhone(parsed.data.contact); } catch { throw new SecurityError(400, "INVALID_PHONE"); }
    await enforceLimits([{ scope: "register-source", subject: requestSource(request), seconds: 900, maximum: 20 }]);
    const jar = await cookies();
    const proof = jar.get(GRANT_COOKIE)?.value;
    const binding = jar.get(BINDING_COOKIE)?.value;
    if (!validSecret(proof) || !validSecret(binding)) throw new SecurityError(403, "REGISTRATION_EXPIRED");
    const token = await prisma.$transaction(async tx => {
      const consumed = await tx.registrationGrant.updateMany({
        where: { tokenHash: digest(proof), browserBindingHash: digest(binding), phone, purpose: "REGISTER", consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1 || await tx.user.findUnique({ where: { contact: phone }, select: { id: true } })) throw new SecurityError(403, "REGISTRATION_EXPIRED");
      const user = await tx.user.create({ data: { contact: phone, contactVerifiedAt: new Date(), fname: parsed.data.fname, lname: parsed.data.lname, email: parsed.data.email ? normalizeEmail(parsed.data.email) : null }, select: { id: true } });
      return insertSession(tx, user.id, jar.get(SESSION_COOKIE_NAME)?.value);
    });
    await setSessionCookie(token);
    jar.set(GRANT_COOKIE, "", cookieOptions(0));
    securityEvent("auth_succeeded");
    return privateJson({ success: true });
  } catch (error) { return securityFailure(error, "REGISTER_FAILED"); }
}
