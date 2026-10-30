import { privateJson, securityFailure } from "@/lib/security/http";
import { getPublishedTeam } from "@/lib/team/service";

export async function GET() {
  try {
    return privateJson(await getPublishedTeam());
  } catch (error) { return securityFailure(error); }
}
