import { listTickets } from "@/lib/support/service";
import { privateJson, securityFailure } from "@/lib/security/http";
export async function GET(request: Request) { try { return privateJson(await listTickets(request, true)); } catch (error) { return securityFailure(error); } }
