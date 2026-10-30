import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/authorization";
import { authorizeMutation } from "@/lib/auth/mutation";
import { readUsername, usernameSupported, requireUsernameSupport, registrationConflict } from "@/lib/account/profile";
import { optionalUsernameSchema } from "@/lib/account/identity";
import { enforceLimits } from "@/lib/security/rate-limit";
import { privateJson, readJson, SecurityError, securityFailure, validateMutation } from "@/lib/security/http";

export async function GET() {
  try {
    const actor = await requireAuth();
    return privateJson({ username: await readUsername(actor.id), usernameSupported: await usernameSupported() });
  } catch (error) { return securityFailure(error); }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAuth();
    validateMutation(request);
    const input = z.object({ username: optionalUsernameSchema }).strict().safeParse(await readJson(request, 1024));
    if (!input.success) {
      const message = input.error.issues[0]?.message;
      throw new SecurityError(422, message === "USERNAME_RESERVED" || message === "NAME_PROHIBITED" ? message : "USERNAME_INVALID");
    }
    await enforceLimits([{ scope: "profile-username", subject: actor.id, seconds: 60, maximum: 10 }], "MANAGEMENT_RATE_LIMIT");
    await prisma.$transaction(async tx => {
      await authorizeMutation(tx, actor);
      await requireUsernameSupport(tx);
      await tx.user.update({ where: { id: actor.id }, data: { username: input.data.username }, select: { id: true } });
    }, { isolationLevel: "ReadCommitted" });
    return privateJson({ success: true, username: input.data.username });
  } catch (error) { return securityFailure(registrationConflict(error) ?? error); }
}
