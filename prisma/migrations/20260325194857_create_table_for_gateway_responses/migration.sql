/*
  Warnings:

  - You are about to drop the column `metadata` on the `transactions` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "GatewayProvider" AS ENUM ('efi');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('GENERATE_DONATION_QRCODE', 'RESPONSE_WEBHOOK_PIX', 'REQUEST_WITHDRAWAL', 'RESPONSE_WEBHOOK_WITHDRAWAL');

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "metadata";

-- CreateTable
CREATE TABLE "gateway_responses" (
    "id" VARCHAR(36) NOT NULL,
    "external_id" VARCHAR(100),
    "interaction_type" "InteractionType" NOT NULL,
    "status_code" INTEGER,
    "payload" JSONB NOT NULL,
    "provider" "GatewayProvider" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateway_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gateway_responses_external_id_idx" ON "gateway_responses"("external_id");
