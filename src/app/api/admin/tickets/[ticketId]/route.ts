import { changeTicket, ticketDetail } from "@/lib/support/service";
import { privateJson, securityFailure } from "@/lib/security/http";
type Context = { params: Promise<{ ticketId: string }> };
export async function GET(request: Request, context: Context) { try { return privateJson(await ticketDetail(request, (await context.params).ticketId, true)); } catch (error) { return securityFailure(error); } }
export async function PATCH(request: Request, context: Context) { try { return privateJson(await changeTicket(request, (await context.params).ticketId, true)); } catch (error) { return securityFailure(error); } }
