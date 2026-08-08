-- AlterTable
ALTER TABLE "users" ADD COLUMN     "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totp_secret" VARCHAR(500);

-- RenameIndex
ALTER INDEX "withdrawals_user_client_key" RENAME TO "withdrawals_user_id_client_key_key";
