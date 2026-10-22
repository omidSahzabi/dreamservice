-- Additive only; existing order statuses and records are unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE "entity"."users" ADD COLUMN "contactVerifiedAt" TIMESTAMP(3);
CREATE TABLE "entity"."order_status_history" (
  "id" UUID NOT NULL PRIMARY KEY,
  "orderId" INTEGER NOT NULL REFERENCES "entity"."orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "previousStatus" TEXT NOT NULL,
  "newStatus" TEXT NOT NULL,
  "adminUserId" UUID NOT NULL REFERENCES "entity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "message" VARCHAR(2000) NOT NULL CHECK (length(btrim("message")) > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notificationState" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("notificationState" IN ('PENDING','CLAIMED','SENT','FAILED','UNKNOWN','SKIPPED')),
  "notificationAttempts" INTEGER NOT NULL DEFAULT 0 CHECK ("notificationAttempts" BETWEEN 0 AND 3),
  "notificationNextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notificationUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "order_status_history_orderId_createdAt_idx" ON "entity"."order_status_history"("orderId", "createdAt");
COMMIT;
