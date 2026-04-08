/*
  Warnings:

  - You are about to drop the column `amount` on the `withdrawals` table. All the data in the column will be lost.
  - You are about to drop the column `pix_key_id` on the `withdrawals` table. All the data in the column will be lost.
  - You are about to drop the column `pix_key_value` on the `withdrawals` table. All the data in the column will be lost.
  - Added the required column `gross_amount` to the `withdrawals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pix_id` to the `withdrawals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pix_value` to the `withdrawals` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "withdrawals" DROP CONSTRAINT "withdrawals_pix_key_id_fkey";

-- AlterTable
ALTER TABLE "withdrawals" DROP COLUMN "amount",
DROP COLUMN "pix_key_id",
DROP COLUMN "pix_key_value",
ADD COLUMN     "gross_amount" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "pix_id" VARCHAR(36) NOT NULL,
ADD COLUMN     "pix_value" VARCHAR(255) NOT NULL;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_pix_id_fkey" FOREIGN KEY ("pix_id") REFERENCES "pix_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
