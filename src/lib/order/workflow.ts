import "server-only";
import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import {requireAdmin, requireAuth, requireOwnership} from "@/lib/auth/authorization";
import {readJson, SecurityError, securityEvent, validateMutation} from "@/lib/security/http";
import {transitionSchema, allowedOrderActions} from "@/schemas/orderWorkflow";
import {deliverOrderNotification} from "@/lib/order/notifications";

async function workflowOperation<T>(operation: string, run: () => Promise<T>): Promise<T> {
  try { return await run(); }
  catch (error) {
    if (process.env.NODE_ENV === "development" && !(error instanceof SecurityError)) {
      const category = typeof prisma.orderStatusHistory === "undefined" ? "stale_prisma_client" :
        error instanceof Prisma.PrismaClientKnownRequestError ? "database_query" :
        error instanceof Prisma.PrismaClientValidationError ? "prisma_validation" :
        error instanceof TypeError ? "type_error" : "unexpected";
      const code = error instanceof Prisma.PrismaClientKnownRequestError && /^P\d{4}$/.test(error.code) ? error.code : undefined;
      // Do not log messages, query inputs, customer data, or exception objects.
      console.warn(JSON.stringify({event: "order_workflow_failed", operation, category, ...(code ? {code} : {})}));
    }
    throw error;
  }
}

export async function changeOrderStatus(request: Request, orderId: number) {
  const admin = await requireAdmin();
  validateMutation(request);
  const parsed = transitionSchema.safeParse(await readJson(request, 12000));
  if (!parsed.success) throw new SecurityError(422, "INVALID_INPUT");
  const {expectedStatus, newStatus, message} = parsed.data;
  if (!allowedOrderActions(expectedStatus).some(status => status === newStatus)) throw new SecurityError(422, "ORDER_TRANSITION_INVALID");
  const history = await prisma.$transaction(async tx => {
    const changed = await tx.order.updateMany({where: {order_id: orderId, status: expectedStatus}, data: {status: newStatus}});
    if (changed.count !== 1) throw new SecurityError(409, "ORDER_STATUS_CONFLICT");
    return workflowOperation("history_create", async () => tx.orderStatusHistory.create({data: {orderId, previousStatus: expectedStatus, newStatus, adminUserId: admin.id, message}}));
  });
  // Delivery is outside the transaction: no delivery error can undo a decision.
  await deliverOrderNotification(history.id).catch(() => {securityEvent("operation_failed");});
  return {success: true, historyId: history.id};
}

export async function orderHistory(orderId: number) {
  const principal = await requireAuth();
  const order = await prisma.order.findUnique({where: {order_id: orderId}, select: {order_id: true, client_id: true, status: true, type: true, page_count: true, budget_range: true, description: true}});
  if (!order) throw new SecurityError(404, "NOT_FOUND");
  requireOwnership(principal, order.client_id);
  const history = await workflowOperation("history_read", async () => prisma.orderStatusHistory.findMany({where: {orderId}, orderBy: [{createdAt: "desc"}, {id: "desc"}], select: {
    id: true, previousStatus: true, newStatus: true, message: true, createdAt: true,
    ...(principal.permission === "ADMIN" ? {notificationState: true, notificationAttempts: true, notificationNextAttemptAt: true} : {}),
  }}));
  return {success: true, order: {order_id: order.order_id, status: order.status, type: order.type, page_count: order.page_count, budget_range: order.budget_range, description: order.description}, history};
}
