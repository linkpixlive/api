/*
  Warnings:

  - You are about to drop the `ChangePassword` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ChangePassword" DROP CONSTRAINT "ChangePassword_user_id_fkey";

-- DropTable
DROP TABLE "ChangePassword";

-- CreateTable
CREATE TABLE "change_password" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_password_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "change_password" ADD CONSTRAINT "change_password_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
