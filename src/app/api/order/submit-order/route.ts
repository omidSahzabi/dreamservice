import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/authorization";
import { digest } from "@/lib/security/crypto";
import { canonicalJson, parseOrderRequest, validateOrder } from "@/lib/order/validation";
import { privateJson, readJson, SecurityError, securityFailure, validateMutation } from "@/lib/security/http";

export async function POST(request: Request) {
  try {
    const principal = await requireAuth();
    validateMutation(request);
    const input = parseOrderRequest(await readJson(request));
    const key = z.string().uuid().safeParse(request.headers.get("idempotency-key"));
    if (!key.success) throw new SecurityError(400, "INVALID_INPUT");
    const requestHash = digest(canonicalJson(input));
    const where = { client_id_idempotency_key: { client_id: principal.id, idempotency_key: key.data } };
    const existing = await prisma.order.findUnique({ where, select: { order_id: true, request_hash: true } });
    if (existing) {
      if (existing.request_hash !== requestHash) throw new SecurityError(409, "IDEMPOTENCY_CONFLICT");
      return privateJson({ success: true, order_id: existing.order_id });
    }
    const validated = await validateOrder(input);
    try {
      const order = await prisma.order.create({ data: { ...validated, client_id: principal.id, status: "PENDING", idempotency_key: key.data, request_hash: requestHash }, select: { order_id: true } });
      return privateJson({ success: true, order_id: order.order_id }, 201);
    } catch (error) {
      // Resolve the unique-key race without retrying an unscoped write.
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") throw error;
      const winner = await prisma.order.findUnique({ where, select: { order_id: true, request_hash: true } });
      if (!winner) throw error;
      if (winner.request_hash !== requestHash) throw new SecurityError(409, "IDEMPOTENCY_CONFLICT");
      return privateJson({ success: true, order_id: winner.order_id });
    }
  } catch (error) { return securityFailure(error, "ORDER_SUBMIT_FAILED"); }
}
