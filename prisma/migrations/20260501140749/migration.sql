/*
  Warnings:

  - You are about to drop the column `overlay_key` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token]` on the table `widgets` will be added. If there are existing duplicate values, this will fail.
  - The required column `token` was added to the `widgets` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropIndex
DROP INDEX "users_overlay_key_key";

-- AlterTable
ALTER TABLE "donation_settings" ALTER COLUMN "filter_profanity" SET DEFAULT false,
ALTER COLUMN "filter_spam" SET DEFAULT false;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "overlay_key";

-- AlterTable
ALTER TABLE "widgets" ADD COLUMN     "token" VARCHAR(36) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "widgets_token_key" ON "widgets"("token");
