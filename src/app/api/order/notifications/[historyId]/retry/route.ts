import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {requireAdmin} from "@/lib/auth/authorization";
import {deliverOrderNotification} from "@/lib/order/notifications";
import {privateJson, SecurityError, securityFailure, validateMutation} from "@/lib/security/http";

export async function POST(request: Request, {params}: {params: Promise<{historyId: string}>}) {
  try {
    const actor = await requireAdmin();
    validateMutation(request);
    const parsed = z.string().uuid().safeParse((await params).historyId);
    if (!parsed.success) throw new SecurityError(422, "INVALID_INPUT");
    const row = await prisma.orderStatusHistory.findUnique({where: {id: parsed.data}, select: {notificationState: true}});
    if (!row) throw new SecurityError(404, "NOT_FOUND");
    if (!await deliverOrderNotification(parsed.data, actor)) throw new SecurityError(409, "NOTIFICATION_RETRY_UNAVAILABLE");
    return privateJson({success: true});
  } catch (error) { return securityFailure(error); }
}
