import {temporaryAdminPasswordLogin} from "@/lib/auth/temporary-admin-login";
import {privateJson, securityFailure} from "@/lib/security/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try { return privateJson(await temporaryAdminPasswordLogin(request)); }
  catch (error) { return securityFailure(error, "TEMP_ADMIN_LOGIN_FAILED"); }
}
