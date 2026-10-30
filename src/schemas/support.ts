import { z } from "zod";

export const ticketStatuses = ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "CLOSED"] as const;
export const ticketPriorities = ["LOW", "NORMAL", "HIGH"] as const;
const uuid = z.string().uuid();
const body = z.string().trim().min(1).max(8000);
export const ticketCreateSchema = z.object({ subject: z.string().trim().min(1).max(200), body,
  orderId: z.number().int().positive().max(2147483647).nullable(), requestKey: uuid }).strict();
export const ticketReplySchema = z.object({ body, requestKey: uuid }).strict();
export const ticketChangeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), status: z.enum(ticketStatuses), expectedUpdatedAt: z.string().datetime() }).strict(),
  z.object({ action: z.literal("priority"), priority: z.enum(ticketPriorities), expectedUpdatedAt: z.string().datetime() }).strict(),
  z.object({ action: z.literal("reopen"), expectedUpdatedAt: z.string().datetime() }).strict(),
]);
const page = z.coerce.number().int().min(1).max(100000).default(1);
const limit = z.coerce.number().int().min(1).max(50).default(20);
export const ticketListSchema = z.object({ page, limit, search: z.string().trim().max(200).default(""),
  status: z.enum(ticketStatuses).optional(), priority: z.enum(ticketPriorities).optional() }).strict();
export const messagePageSchema = z.object({ page, limit }).strict();
export const ownedOrdersSchema = z.object({ page, limit, selected: z.coerce.number().int().positive().max(2147483647).optional() }).strict();
export const ticketRowSchema = z.object({ id: uuid, number: z.number().int(), subject: z.string(), status: z.enum(ticketStatuses),
  priority: z.enum(ticketPriorities), createdAt: z.string().datetime(), updatedAt: z.string().datetime(), lastMessageAt: z.string().datetime(), closedAt: z.string().datetime().nullable(),
  customer: z.object({ fname: z.string().nullable(), lname: z.string().nullable() }),
  order: z.object({ order_id: z.number(), type: z.string().nullable(), status: z.string().nullable() }).nullable() });
export type TicketRow = z.infer<typeof ticketRowSchema>;
export const ticketListResponseSchema = z.object({ data: z.array(ticketRowSchema), total: z.number(),
  summary: z.object({ OPEN: z.number(), IN_PROGRESS: z.number(), WAITING_FOR_CUSTOMER: z.number(), CLOSED: z.number() }) });
export const ticketDetailSchema = z.object({ ticket: ticketRowSchema, total: z.number(),
  messages: z.array(z.object({ id: uuid, body: z.string(), isAdmin: z.boolean(), createdAt: z.string().datetime() })) });
export const ownedOrdersResponseSchema = z.object({ data: z.array(z.object({ order_id: z.number(), type: z.string().nullable() })), total: z.number(),
  selected: z.object({ order_id: z.number(), type: z.string().nullable() }).nullable() });
export const notificationsResponseSchema = z.object({ data: z.array(z.object({ id: uuid, createdAt: z.string().datetime(), ticket: z.object({ id: uuid, number: z.number(), subject: z.string() }) })), total: z.number() });
export function canChangeTicketStatus(previous: typeof ticketStatuses[number], next: typeof ticketStatuses[number]) {
  return previous !== "CLOSED" && next !== previous;
}
