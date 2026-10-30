import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLE, requireAdmin, requireAuth, type Principal } from "@/lib/auth/authorization";
import { readJson, SecurityError, validateMutation } from "@/lib/security/http";
import { enforceLimits } from "@/lib/security/rate-limit";
import { canChangeTicketStatus, messagePageSchema, ownedOrdersSchema, ticketChangeSchema, ticketCreateSchema, ticketListSchema, ticketReplySchema } from "@/schemas/support";

const actorFor = (admin: boolean) => admin ? requireAdmin() : requireAuth();
const ticketSelect = { id: true, number: true, subject: true, status: true, priority: true, createdAt: true, updatedAt: true,
  lastMessageAt: true, closedAt: true, customer: { select: { fname: true, lname: true } },
  order: { select: { order_id: true, client_id: true, type: true, status: true } } } satisfies Prisma.SupportTicketSelect;
function parameters<T>(request: Request, schema: z.ZodType<T>) {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(key => params.getAll(key).length !== 1)) throw new SecurityError(422, "INVALID_INPUT");
  const result = schema.safeParse(Object.fromEntries(params));
  if (!result.success) throw new SecurityError(422, "INVALID_INPUT");
  return result.data;
}
function validId(id: string) { if (!z.string().uuid().safeParse(id).success) throw new SecurityError(422, "INVALID_INPUT"); }
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const scope = (actor: Principal, admin: boolean) => admin ? {} : { customerId: actor.id };
function publicTicket(row: Prisma.SupportTicketGetPayload<{ select: typeof ticketSelect }> & { customerId: string }) {
  // Never expose a transferred/reassigned order or customer identifiers.
  const { customerId, order, ...ticket } = row;
  return { ...ticket, order: order?.client_id === customerId ? { order_id: order.order_id, type: order.type, status: order.status } : null };
}
async function reauthorize(tx: Prisma.TransactionClient, actor: Principal, admin: boolean, requestKey?: string) {
  // Management changes take the exclusive version of this existing lock.
  // Shared locks permit concurrent tickets while serializing bans/demotions.
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock_shared(84190231)`;
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { bannedAt: true } });
  if (!user || user.bannedAt) throw new SecurityError(401, "UNAUTHENTICATED");
  if (admin && !await tx.personProfile.findFirst({ where: { user_id: actor.id, role: ADMIN_ROLE }, select: { pr_id: true } })) throw new SecurityError(403, "FORBIDDEN");
  if (requestKey) await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${actor.id + ":" + requestKey}, 6321))`;
}
async function lockedTicket(tx: Prisma.TransactionClient, id: string, actor: Principal, admin: boolean) {
  await tx.$queryRaw`SELECT "id" FROM "entity"."support_tickets" WHERE "id" = ${id}::uuid FOR UPDATE`;
  const ticket = await tx.supportTicket.findUnique({ where: { id } });
  if (!ticket || (!admin && ticket.customerId !== actor.id)) throw new SecurityError(404, "NOT_FOUND");
  return ticket;
}
async function mutation<T>(actor: Principal, admin: boolean, requestKey: string | undefined, run: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await prisma.$transaction(async tx => { await reauthorize(tx, actor, admin, requestKey); return run(tx); }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw new SecurityError(409, "TICKET_CONFLICT");
    throw error;
  }
}
async function notification(tx: Prisma.TransactionClient, ticketId: string, messageId: string, recipientId: string | null) {
  // The committed record IS the in-app delivery. No provider or SMS call occurs.
  await tx.supportTicketNotification.create({ data: { ticketId, messageId, recipientId } });
}
export async function listTickets(request: Request, admin = false) {
  const actor = await actorFor(admin);
  const { page, limit, search, status, priority } = parameters(request, ticketListSchema);
  const contains = search.replace(/[\\%_]/g, "\\$&");
  const number = /^#?\d+$/.test(search) ? Number(search.replace("#", "")) : null;
  const where: Prisma.SupportTicketWhereInput = { ...scope(actor, admin), ...(status ? { status } : {}), ...(priority ? { priority } : {}),
    ...(search ? { OR: [{ subject: { contains, mode: "insensitive" } },
      ...(z.string().uuid().safeParse(search).success ? [{ id: search }] : []),
      ...(number && number <= 2147483647 ? [{ number }] : []),
      ...(admin ? [{ customer: { OR: ["fname", "lname", "email", "contact"].map(key => ({ [key]: { contains, mode: "insensitive" } })) } }] : [])] } : {}) };
  return prisma.$transaction(async tx => {
    const rows = await tx.supportTicket.findMany({ where, select: { ...ticketSelect, customerId: true }, orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit });
    const groups = await tx.supportTicket.groupBy({ by: ["status"], where: scope(actor, admin), _count: true });
    const summary = { OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_CUSTOMER: 0, CLOSED: 0 };
    for (const group of groups) summary[group.status] = group._count;
    return { data: rows.map(publicTicket), total: await tx.supportTicket.count({ where }), summary };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function createTicket(request: Request) {
  const actor = await requireAuth();validateMutation(request);
  const parsed = ticketCreateSchema.safeParse(await readJson(request, 40000));
  if (!parsed.success) throw new SecurityError(422, "INVALID_INPUT");
  await enforceLimits([{ scope: "ticket-create", subject: actor.id, seconds: 3600, maximum: 10 }], "TICKET_RATE_LIMIT");
  const { requestKey, subject, body, orderId } = parsed.data;
  const requestHash = hash({ subject, body, orderId });
  return mutation(actor, false, requestKey, async tx => {
    const previous = await tx.supportTicket.findUnique({ where: { customerId_requestKey: { customerId: actor.id, requestKey } }, select: { id: true, requestHash: true } });
    if (previous) { if (previous.requestHash !== requestHash) throw new SecurityError(409, "IDEMPOTENCY_CONFLICT"); return { id: previous.id }; }
    if (orderId !== null && !await tx.order.findFirst({ where: { order_id: orderId, client_id: actor.id }, select: { order_id: true } })) throw new SecurityError(422, "TICKET_ORDER_INVALID");
    const now = new Date();
    const ticket = await tx.supportTicket.create({ data: { customerId: actor.id, orderId, subject, requestKey, requestHash, lastMessageAt: now } });
    const message = await tx.supportTicketMessage.create({ data: { ticketId: ticket.id, senderId: actor.id, isAdmin: false, body, requestKey, requestHash, createdAt: now } });
    await notification(tx, ticket.id, message.id, null);
    return { id: ticket.id };
  });
}
export async function ticketDetail(request: Request, id: string, admin = false) {
  const actor = await actorFor(admin);validId(id);
  const { page, limit } = parameters(request, messagePageSchema);
  return prisma.$transaction(async tx => {
    const ticket = await tx.supportTicket.findFirst({ where: { id, ...scope(actor, admin) }, select: { ...ticketSelect, customerId: true } });
    if (!ticket) throw new SecurityError(404, "NOT_FOUND");
    const messages = await tx.supportTicketMessage.findMany({ where: { ticketId: id }, select: { id: true, body: true, isAdmin: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit });
    return { ticket: publicTicket(ticket), messages: messages.reverse(), total: await tx.supportTicketMessage.count({ where: { ticketId: id } }) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function replyToTicket(request: Request, id: string, admin = false) {
  const actor = await actorFor(admin);validId(id);validateMutation(request);
  const parsed = ticketReplySchema.safeParse(await readJson(request, 40000));
  if (!parsed.success) throw new SecurityError(422, "INVALID_INPUT");
  await enforceLimits([{ scope: "ticket-reply", subject: actor.id, seconds: 60, maximum: 20 }], "TICKET_RATE_LIMIT");
  const { body, requestKey } = parsed.data;const requestHash = hash({ id, body, admin });
  return mutation(actor, admin, requestKey, async tx => {
    const ticket = await lockedTicket(tx, id, actor, admin);
    const previous = await tx.supportTicketMessage.findUnique({ where: { senderId_requestKey: { senderId: actor.id, requestKey } } });
    if (previous) { if (previous.ticketId !== id || previous.requestHash !== requestHash) throw new SecurityError(409, "IDEMPOTENCY_CONFLICT"); return { id: previous.id }; }
    if (ticket.status === "CLOSED") throw new SecurityError(409, "TICKET_CLOSED");
    const now = new Date(Math.max(Date.now(), ticket.lastMessageAt.getTime() + 1, ticket.updatedAt.getTime() + 1));
    const message = await tx.supportTicketMessage.create({ data: { ticketId: id, senderId: actor.id, isAdmin: admin, body, requestKey, requestHash, createdAt: now } });
    await tx.supportTicket.update({ where: { id }, data: { status: admin ? "WAITING_FOR_CUSTOMER" : "OPEN", closedAt: null, lastMessageAt: now, updatedAt: now } });
    if (!admin || ticket.customerId !== actor.id) await notification(tx, id, message.id, admin ? ticket.customerId : null);
    return { id: message.id };
  });
}
export async function changeTicket(request: Request, id: string, admin = false) {
  const actor = await actorFor(admin);validId(id);validateMutation(request);
  const parsed = ticketChangeSchema.safeParse(await readJson(request, 2000));
  if (!parsed.success) throw new SecurityError(422, "INVALID_INPUT");
  const change = parsed.data;
  if (!admin && change.action !== "reopen") throw new SecurityError(403, "FORBIDDEN");
  await enforceLimits([{ scope: "ticket-change", subject: actor.id, seconds: 60, maximum: 30 }], "TICKET_RATE_LIMIT");
  return mutation(actor, admin, undefined, async tx => {
    const ticket = await lockedTicket(tx, id, actor, admin);
    if (ticket.updatedAt.toISOString() !== change.expectedUpdatedAt) throw new SecurityError(409, "TICKET_CONFLICT");
    const now = new Date(Math.max(Date.now(), ticket.updatedAt.getTime() + 1));
    const data: Prisma.SupportTicketUpdateInput = { updatedAt: now };
    if (change.action === "priority") data.priority = change.priority;
    else if (change.action === "reopen") {
      if (ticket.status !== "CLOSED") throw new SecurityError(409, "TICKET_TRANSITION_INVALID");
      data.status = "OPEN";data.closedAt = null;
    } else {
      if (!canChangeTicketStatus(ticket.status, change.status)) throw new SecurityError(422, "TICKET_TRANSITION_INVALID");
      data.status = change.status;data.closedAt = change.status === "CLOSED" ? now : null;
    }
    await tx.supportTicket.update({ where: { id }, data });return { success: true };
  });
}
export async function ownedSupportOrders(request: Request) {
  const actor = await requireAuth();const { page, limit, selected } = parameters(request, ownedOrdersSchema);
  const where = { client_id: actor.id };const select = { order_id: true, type: true } as const;
  const chosen = selected ? await prisma.order.findFirst({ where: { ...where, order_id: selected }, select }) : null;
  if (selected && !chosen) throw new SecurityError(404, "NOT_FOUND");
  return { data: await prisma.order.findMany({ where, select, orderBy: { order_id: "desc" }, skip: (page - 1) * limit, take: limit }),
    total: await prisma.order.count({ where }), selected: chosen };
}
export async function ticketNotifications(request: Request, admin = false) {
  const actor = await actorFor(admin);const { page, limit } = parameters(request, messagePageSchema);
  const where: Prisma.SupportTicketNotificationWhereInput = { message: { senderId: { not: actor.id } },
    OR: [{ recipientId: actor.id, ticket: { customerId: actor.id } }, ...(admin ? [{ recipientId: null }] : [])] };
  return { data: await prisma.supportTicketNotification.findMany({ where, select: { id: true, createdAt: true, ticket: { select: { id: true, number: true, subject: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit }), total: await prisma.supportTicketNotification.count({ where }) };
}
