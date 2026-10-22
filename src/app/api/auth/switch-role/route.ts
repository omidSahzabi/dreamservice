import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { privateJson, readJson, SecurityError, securityFailure, validateMutation } from "@/lib/security/http";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new SecurityError(401, "UNAUTHENTICATED");
    validateMutation(request);
    const parsed = z.object({ role: z.string().min(1).max(100) }).strict().safeParse(await readJson(request, 2048));
    if (!parsed.success) throw new SecurityError(422, "INVALID_ROLE");
    if (!user.roles.includes(parsed.data.role)) throw new SecurityError(403, "FORBIDDEN");
    return privateJson({ success: true, activeRole: parsed.data.role });
  } catch (error) { return securityFailure(error); }
}
