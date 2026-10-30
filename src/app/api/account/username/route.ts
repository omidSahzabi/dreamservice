import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getAuthenticatedPrincipal } from "@/lib/auth/authorization";
import { BINDING_COOKIE, GRANT_COOKIE } from "@/lib/auth/otp";
import { digest, validSecret } from "@/lib/security/crypto";
import { usernameSchema } from "@/lib/account/identity";
import { requireUsernameSupport } from "@/lib/account/profile";
import { enforceLimits } from "@/lib/security/rate-limit";
import { privateJson, SecurityError, securityFailure } from "@/lib/security/http";

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedPrincipal();
    let subject = actor?.id;
    if (!subject) {
      const jar = await cookies();
      const proof = jar.get(GRANT_COOKIE)?.value;
      const binding = jar.get(BINDING_COOKIE)?.value;
      if (!validSecret(proof) || !validSecret(binding)) throw new SecurityError(401, "UNAUTHENTICATED");
      const grant = await prisma.registrationGrant.findUnique({ where: { tokenHash: digest(proof) } });
      if (!grant || grant.browserBindingHash !== digest(binding) || grant.purpose !== "REGISTER" || grant.consumedAt || grant.expiresAt <= new Date()) throw new SecurityError(401, "UNAUTHENTICATED");
      subject = "grant:" + digest(proof);
    }
    const input = usernameSchema.safeParse(new URL(request.url).searchParams.get("username"));
    if (!input.success) {
      const message = input.error.issues[0]?.message;
      throw new SecurityError(422, message === "USERNAME_RESERVED" || message === "NAME_PROHIBITED" ? message : "USERNAME_INVALID");
    }
    await requireUsernameSupport();
    await enforceLimits([{ scope: "username-check", subject, seconds: 60, maximum: 30 }], "MANAGEMENT_RATE_LIMIT");
    const user = await prisma.user.findUnique({ where: { username: input.data }, select: { id: true } });
    return privateJson({ available: !user || user.id === actor?.id });
  } catch (error) { return securityFailure(error); }
}
