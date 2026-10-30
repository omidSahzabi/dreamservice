-- Additive only. Existing usernames stay NULL; contact strings are not rewritten.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "entity"."users" ADD COLUMN "username" VARCHAR(30);
ALTER TABLE "entity"."users" ADD CONSTRAINT "users_username_format_check" CHECK (
  "username" IS NULL OR (
    "username" COLLATE "C" ~ '^[a-z0-9_]{3,30}$'
    AND "username" = lower("username")
    AND "username" NOT IN ('admin','administrator','support','api','root','dreamservice')
  )
);
CREATE UNIQUE INDEX "users_username_key" ON "entity"."users"("username");

-- Mirrors normalizePhone: Persian/Arabic digits, separators, country prefixes.
-- Invalid legacy contacts yield NULL and remain unchanged and unclaimed.
CREATE FUNCTION "entity"."canonical_iran_mobile"(input TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE AS $$
DECLARE formatted TEXT; unwrapped TEXT; digits TEXT;
BEGIN
  -- Match the TypeScript lexical guard before removing permitted formatting.
  formatted := replace(translate(input, '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'), ' ', '');
  unwrapped := regexp_replace(formatted, '\(([0-9]+)\)', '\1', 'g');
  IF unwrapped ~ '[^+0-9-]' OR unwrapped !~ '^\+?[0-9]+(?:-[0-9]+)*$' THEN
    RETURN NULL;
  END IF;
  digits := regexp_replace(unwrapped, '[+-]', '', 'g');
  IF left(formatted, 1) = '+' THEN
    RETURN CASE WHEN digits ~ '^989[0-9]{9}$' THEN '0' || substr(digits, 3) ELSE NULL END;
  END IF;
  -- Match full lengths/structures, so ten-digit 98... remains national.
  RETURN CASE
    WHEN digits ~ '^9[0-9]{9}$' THEN '0' || digits
    WHEN digits ~ '^09[0-9]{9}$' THEN digits
    WHEN digits ~ '^989[0-9]{9}$' THEN '0' || substr(digits, 3)
    WHEN digits ~ '^00989[0-9]{9}$' THEN '0' || substr(digits, 5)
    ELSE NULL END;
END;
$$;
CREATE UNIQUE INDEX "users_canonical_phone_key" ON "entity"."users" ("entity"."canonical_iran_mobile"("contact"))
WHERE "entity"."canonical_iran_mobile"("contact") IS NOT NULL;

-- No open-order unique index: preflight found historical conflicts. It must
-- remain blocked until the owner approves a nondestructive resolution policy.
COMMIT;
