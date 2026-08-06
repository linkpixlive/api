-- Add columns as nullable first so backfill works on non-empty tables
ALTER TABLE "withdrawals" ADD COLUMN "key_masked" VARCHAR(255);
ALTER TABLE "withdrawals" ADD COLUMN "client_key" VARCHAR(128);

-- Backfill key_masked from the related pix_keys row
UPDATE "withdrawals" w
SET "key_masked" = pk."key_masked"
FROM "pix_keys" pk
WHERE w."pix_id" = pk."id"
  AND w."key_masked" IS NULL;

-- Any remaining rows without a linked pix key get a safe placeholder
UPDATE "withdrawals"
SET "key_masked" = '***'
WHERE "key_masked" IS NULL;

-- Now enforce NOT NULL on key_masked
ALTER TABLE "withdrawals" ALTER COLUMN "key_masked" SET NOT NULL;

-- Idempotency guard: one active clientKey per user (NULLs allowed by default in Postgres)
CREATE UNIQUE INDEX "withdrawals_user_client_key" ON "withdrawals"("user_id", "client_key");
