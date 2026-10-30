import { listProjects, saveProject } from "@/lib/admin/projects";
import { privateJson, securityFailure } from "@/lib/security/http";

export async function GET(request: Request) {
  try { return privateJson(await listProjects(request)); }
  catch (error) { return securityFailure(error); }
}
export async function POST(request: Request) {
  try { return privateJson(await saveProject(request), 201); }
  catch (error) { return securityFailure(error); }
}
