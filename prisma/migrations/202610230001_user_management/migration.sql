-- Additive only. Apply after a verified backup and baseline integrity snapshot.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE "entity"."users" ADD COLUMN "bannedAt" TIMESTAMP(3);
CREATE TABLE "entity"."user_management_audit" (
  "id" UUID NOT NULL PRIMARY KEY,
  "targetUserId" UUID NOT NULL REFERENCES "entity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorUserId" UUID NOT NULL REFERENCES "entity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "action" VARCHAR(20) NOT NULL CHECK ("action" IN ('promote','demote','ban','unban')),
  "previousValue" JSONB NOT NULL,
  "newValue" JSONB NOT NULL,
  "reason" VARCHAR(1000) NOT NULL CHECK (length(btrim("reason")) > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "user_management_audit_targetUserId_createdAt_idx" ON "entity"."user_management_audit"("targetUserId", "createdAt");
CREATE INDEX "person_profile_user_id_role_idx" ON "upro"."person_profile"("user_id", "role");
COMMIT;
