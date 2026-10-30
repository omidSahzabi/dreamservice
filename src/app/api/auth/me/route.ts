import { getCurrentUser } from "@/lib/auth/session";
import { ADMIN_ROLE } from "@/lib/auth/authorization";
import { privateJson, securityFailure } from "@/lib/security/http";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return privateJson({ success: Boolean(user), user: user ? { ...user, permission: user.roles.includes(ADMIN_ROLE) ? "ADMIN" : "CUSTOMER" } : null });
  } catch (error) { return securityFailure(error); }
}
