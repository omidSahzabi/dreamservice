import { saveProject } from "@/lib/admin/projects";
import { privateJson, securityFailure } from "@/lib/security/http";

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try { return privateJson(await saveProject(request, (await context.params).projectId)); }
  catch (error) { return securityFailure(error); }
}
