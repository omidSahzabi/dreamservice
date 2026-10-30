import { listUsers } from "@/lib/admin/users";
import { privateJson, securityFailure } from "@/lib/security/http";

export async function GET(request: Request) {
  try { return privateJson(await listUsers(request)); }
  catch (error) { return securityFailure(error); }
}
