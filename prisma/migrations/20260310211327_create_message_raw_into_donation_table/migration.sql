/*
  Warnings:

  - A unique constraint covering the columns `[token]` on the table `change_password` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[transaction_id]` on the table `donations` will be added. If there are existing duplicate values, this will fail.
  - Made the column `transaction_id` on table `donations` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "DonationStatus" ADD VALUE 'expired';

-- AlterTable
ALTER TABLE "donations" ADD COLUMN     "message_raw" VARCHAR(500),
ALTER COLUMN "transaction_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "change_password_token_key" ON "change_password"("token");

-- CreateIndex
CREATE UNIQUE INDEX "donations_transaction_id_key" ON "donations"("transaction_id");
