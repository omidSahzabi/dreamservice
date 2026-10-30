import {z} from "zod";
import {orderHistory} from "@/lib/order/workflow";
import {privateJson, SecurityError, securityFailure} from "@/lib/security/http";

export async function GET(_request: Request, {params}: {params: Promise<{orderId: string}>}) {
  try {
    const parsed = z.coerce.number().int().positive().max(2147483647).safeParse((await params).orderId);
    if (!parsed.success) throw new SecurityError(422, "INVALID_INPUT");
    return privateJson(await orderHistory(parsed.data));
  } catch (error) { return securityFailure(error); }
}
