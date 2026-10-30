import { ticketNotifications } from "@/lib/support/service";
import { privateJson, securityFailure } from "@/lib/security/http";
export async function GET(request: Request) { try { return privateJson(await ticketNotifications(request)); } catch (error) { return securityFailure(error); } }
