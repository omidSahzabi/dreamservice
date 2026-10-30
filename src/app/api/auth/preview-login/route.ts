import {previewPasswordLogin} from "@/lib/auth/preview-login";
import {privateJson, securityFailure} from "@/lib/security/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try { return privateJson(await previewPasswordLogin(request)); }
  catch (error) { return securityFailure(error); }
}
