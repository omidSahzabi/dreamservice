import { invalidateSession } from "@/lib/auth/session";
import { privateJson, securityFailure, validateMutation } from "@/lib/security/http";

export async function POST(request: Request) {
  try {
    validateMutation(request, false);
    await invalidateSession();
    return privateJson({ success: true });
  } catch (error) { return securityFailure(error, "LOGOUT_FAILED"); }
}
