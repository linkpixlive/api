-- DropForeignKey
ALTER TABLE "withdrawals" DROP CONSTRAINT "withdrawals_pix_id_fkey";

-- AlterTable
ALTER TABLE "withdrawals" ALTER COLUMN "pix_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_pix_id_fkey" FOREIGN KEY ("pix_id") REFERENCES "pix_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
