import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/authorization";
import { digest } from "@/lib/security/crypto";
import { canonicalJson, parseOrderRequest, validateOrder } from "@/lib/order/validation";
import { privateJson, readJson, SecurityError, securityFailure, validateMutation } from "@/lib/security/http";
import { authorizeMutation } from "@/lib/auth/mutation";
import { enforceLimits } from "@/lib/security/rate-limit";

const openOrderStatuses = ["PENDING", "NEGOTIATING", "PROCESSING"];

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
    // Already committed retries above are free. Rejected new requests still
    // consume a modest account budget, before expensive form validation.
    await enforceLimits([{ scope: "order-submit", subject: principal.id, seconds: 60, maximum: 20 }], "ORDER_RATE_LIMIT");
    const validated = await validateOrder(input);
    const result = await prisma.$transaction(async tx => {
      await authorizeMutation(tx, principal);
      // The actor row serializes distinct keys and replays for this customer,
      // including databases whose historical open orders block a unique index.
      const replay = await tx.order.findUnique({ where, select: { order_id: true, request_hash: true } });
      if (replay) {
        if (replay.request_hash !== requestHash) throw new SecurityError(409, "IDEMPOTENCY_CONFLICT");
        return { orderId: replay.order_id, created: false };
      }
      const open = await tx.order.findFirst({ where: { client_id: principal.id, status: { in: openOrderStatuses } }, orderBy: { order_id: "asc" }, select: { order_id: true } });
      if (open) return { openOrderId: open.order_id };
      const order = await tx.order.create({ data: { ...validated, client_id: principal.id, status: "PENDING", idempotency_key: key.data, request_hash: requestHash }, select: { order_id: true } });
      return { orderId: order.order_id, created: true };
    }, { isolationLevel: "ReadCommitted" });
    if ("openOrderId" in result) return privateJson({ success: false, code: "ORDER_OPEN_EXISTS", orderId: result.openOrderId }, 409);
    return privateJson({ success: true, order_id: result.orderId }, result.created ? 201 : 200);
  } catch (error) { return securityFailure(error, "ORDER_SUBMIT_FAILED"); }
}
