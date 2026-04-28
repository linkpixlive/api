/*
  Warnings:

  - You are about to drop the `overlay_settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "WidgetType" AS ENUM ('overlay', 'qrcode');

-- DropForeignKey
ALTER TABLE "overlay_settings" DROP CONSTRAINT "overlay_settings_user_id_fkey";

-- DropTable
DROP TABLE "overlay_settings";

-- CreateTable
CREATE TABLE "donation_settings" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "max_length" INTEGER NOT NULL DEFAULT 250,
    "min_audio_amount" DECIMAL(12,2) NOT NULL DEFAULT 1.00,
    "min_text_amount" DECIMAL(12,2) NOT NULL DEFAULT 1.00,
    "filter_profanity" BOOLEAN NOT NULL DEFAULT true,
    "filter_spam" BOOLEAN NOT NULL DEFAULT true,
    "blocked_words" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widgets" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "type" "WidgetType" NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "donation_settings_user_id_key" ON "donation_settings"("user_id");

-- CreateIndex
CREATE INDEX "widgets_user_id_idx" ON "widgets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "widgets_user_id_type_key" ON "widgets"("user_id", "type");

-- AddForeignKey
ALTER TABLE "donation_settings" ADD CONSTRAINT "donation_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widgets" ADD CONSTRAINT "widgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
