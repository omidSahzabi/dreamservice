-- Apply only after the existing schema baseline and recovery point are verified.
-- Bound lock acquisition and keep all additive changes atomic.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "entity"."otp_verifications"
  ADD COLUMN "browserBindingHash" TEXT,
  ADD COLUMN "deliveryState" TEXT;

CREATE TABLE "entity"."registration_grants" (
  "tokenHash" TEXT NOT NULL PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "browserBindingHash" TEXT NOT NULL,
  "purpose" "entity"."OtpPurpose" NOT NULL DEFAULT 'REGISTER',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "registration_grants_expiresAt_idx"
  ON "entity"."registration_grants"("expiresAt");

CREATE TABLE "entity"."security_rate_limits" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "security_rate_limits_expiresAt_idx"
  ON "entity"."security_rate_limits"("expiresAt");

ALTER TABLE "entity"."orders"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "request_hash" TEXT;
CREATE UNIQUE INDEX "orders_client_id_idempotency_key_key"
  ON "entity"."orders"("client_id", "idempotency_key");

COMMIT;
