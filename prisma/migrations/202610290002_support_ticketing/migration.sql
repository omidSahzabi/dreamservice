-- Additive ticketing foundation; existing tables, indexes, and rows are untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TYPE "entity"."SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'CLOSED');
CREATE TYPE "entity"."SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

CREATE TABLE "entity"."support_tickets" (
  "id" UUID NOT NULL,
  "number" SERIAL NOT NULL,
  "customerId" UUID NOT NULL,
  "orderId" INTEGER,
  "subject" VARCHAR(200) NOT NULL,
  "status" "entity"."SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "entity"."SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
  "requestKey" UUID NOT NULL,
  "requestHash" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "lastMessageAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMPTZ(3),
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_tickets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "entity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "support_tickets_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "entity"."orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "support_tickets_subject_check" CHECK (length(btrim("subject")) > 0),
  CONSTRAINT "support_tickets_closed_check" CHECK (("status" = 'CLOSED') = ("closedAt" IS NOT NULL))
);

CREATE TABLE "entity"."support_ticket_messages" (
  "id" UUID NOT NULL,
  "ticketId" UUID NOT NULL,
  "senderId" UUID NOT NULL,
  "isAdmin" BOOLEAN NOT NULL,
  "body" VARCHAR(8000) NOT NULL,
  "requestKey" UUID NOT NULL,
  "requestHash" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "entity"."support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "support_ticket_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "entity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "support_ticket_messages_body_check" CHECK (length(btrim("body")) > 0)
);

CREATE TABLE "entity"."support_ticket_notifications" (
  "id" UUID NOT NULL,
  "ticketId" UUID NOT NULL,
  "messageId" UUID NOT NULL,
  "recipientId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_ticket_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_ticket_notifications_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "entity"."support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "support_ticket_notifications_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "entity"."support_ticket_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "support_ticket_notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "entity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "support_tickets_number_key" ON "entity"."support_tickets"("number");
CREATE UNIQUE INDEX "support_tickets_customerId_requestKey_key" ON "entity"."support_tickets"("customerId", "requestKey");
CREATE INDEX "support_tickets_customerId_lastMessageAt_id_idx" ON "entity"."support_tickets"("customerId", "lastMessageAt", "id");
CREATE INDEX "support_tickets_status_priority_lastMessageAt_id_idx" ON "entity"."support_tickets"("status", "priority", "lastMessageAt", "id");
CREATE INDEX "support_tickets_priority_lastMessageAt_id_idx" ON "entity"."support_tickets"("priority", "lastMessageAt", "id");
CREATE INDEX "support_tickets_lastMessageAt_id_idx" ON "entity"."support_tickets"("lastMessageAt", "id");
CREATE INDEX "support_tickets_orderId_idx" ON "entity"."support_tickets"("orderId");
CREATE UNIQUE INDEX "support_ticket_messages_senderId_requestKey_key" ON "entity"."support_ticket_messages"("senderId", "requestKey");
CREATE INDEX "support_ticket_messages_ticketId_createdAt_id_idx" ON "entity"."support_ticket_messages"("ticketId", "createdAt", "id");
CREATE UNIQUE INDEX "support_ticket_notifications_messageId_key" ON "entity"."support_ticket_notifications"("messageId");
CREATE INDEX "support_ticket_notifications_recipientId_createdAt_id_idx" ON "entity"."support_ticket_notifications"("recipientId", "createdAt", "id");
CREATE INDEX "support_ticket_notifications_ticketId_idx" ON "entity"."support_ticket_notifications"("ticketId");
COMMIT;
