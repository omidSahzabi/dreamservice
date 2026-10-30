import { manageUser, userDetails } from "@/lib/admin/users";
import { privateJson, securityFailure } from "@/lib/security/http";

type Context = { params: Promise<{ userId: string }> };
export async function GET(_request: Request, context: Context) {
  try { return privateJson(await userDetails((await context.params).userId)); }
  catch (error) { return securityFailure(error); }
}
export async function PATCH(request: Request, context: Context) {
  try { return privateJson(await manageUser(request, (await context.params).userId)); }
  catch (error) { return securityFailure(error); }
}
