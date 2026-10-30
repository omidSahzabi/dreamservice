import { createTicket, listTickets } from "@/lib/support/service";
import { privateJson, securityFailure } from "@/lib/security/http";
export async function GET(request: Request) { try { return privateJson(await listTickets(request)); } catch (error) { return securityFailure(error); } }
export async function POST(request: Request) { try { return privateJson(await createTicket(request), 201); } catch (error) { return securityFailure(error); } }
