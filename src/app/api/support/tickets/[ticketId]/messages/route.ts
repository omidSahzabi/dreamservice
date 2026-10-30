import { replyToTicket } from "@/lib/support/service";
import { privateJson, securityFailure } from "@/lib/security/http";
export async function POST(request: Request, { params }: { params: Promise<{ ticketId: string }> }) { try { return privateJson(await replyToTicket(request, (await params).ticketId), 201); } catch (error) { return securityFailure(error); } }
