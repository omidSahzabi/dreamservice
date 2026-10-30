BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TYPE "entity"."ProjectStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TABLE "entity"."projects" (
  "id" UUID NOT NULL,
  "orderId" INTEGER,
  "title" VARCHAR(200) NOT NULL,
  "titleFa" VARCHAR(200) NOT NULL,
  "description" VARCHAR(5000),
  "descriptionFa" VARCHAR(5000),
  "status" "entity"."ProjectStatus" NOT NULL DEFAULT 'PLANNED',
  "startAt" TIMESTAMPTZ(3),
  "deadlineAt" TIMESTAMPTZ(3),
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "showOnHomepage" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "projects_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "entity"."orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "projects_dates_check" CHECK ("startAt" IS NULL OR "deadlineAt" IS NULL OR "deadlineAt" > "startAt"),
  CONSTRAINT "projects_titles_check" CHECK (length(btrim("title")) > 0 AND length(btrim("titleFa")) > 0),
  CONSTRAINT "projects_homepage_check" CHECK (NOT "showOnHomepage" OR ("isPublic" AND "deadlineAt" IS NOT NULL AND "status" IN ('PLANNED', 'ACTIVE')))
);
CREATE UNIQUE INDEX "projects_orderId_key" ON "entity"."projects"("orderId");
CREATE INDEX "projects_status_createdAt_idx" ON "entity"."projects"("status", "createdAt");
-- Prisma cannot represent a partial unique index. Preserve this in future migrations.
CREATE UNIQUE INDEX "projects_single_homepage_key" ON "entity"."projects"("showOnHomepage") WHERE "showOnHomepage" = true;
COMMIT;
