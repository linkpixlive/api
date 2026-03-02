/*
  Warnings:

  - You are about to drop the column `updated_at` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[overlay_key]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - The required column `overlay_key` was added to the `users` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "updated_at",
ADD COLUMN     "overlay_key" VARCHAR(36) NOT NULL;

-- CreateTable
CREATE TABLE "ChangePassword" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangePassword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_overlay_key_key" ON "users"("overlay_key");

-- AddForeignKey
ALTER TABLE "ChangePassword" ADD CONSTRAINT "ChangePassword_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
