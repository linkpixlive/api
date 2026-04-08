/*
  Warnings:

  - Added the required column `amount` to the `withdrawals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "withdrawals" ADD COLUMN     "amount" DECIMAL(12,2) NOT NULL;
