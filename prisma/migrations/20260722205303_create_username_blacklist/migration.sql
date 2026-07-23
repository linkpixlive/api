-- AlterTable
ALTER TABLE "users" ADD COLUMN     "username_changed_at" TIMESTAMP(3),
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "username_blacklist" (
    "id" VARCHAR(36) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "original_owner_id" VARCHAR(36) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "username_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "username_blacklist_username_key" ON "username_blacklist"("username");

-- CreateIndex
CREATE INDEX "username_blacklist_username_idx" ON "username_blacklist"("username");

-- CreateIndex
CREATE INDEX "username_blacklist_expires_at_idx" ON "username_blacklist"("expires_at");

-- AddForeignKey
ALTER TABLE "username_blacklist" ADD CONSTRAINT "username_blacklist_original_owner_id_fkey" FOREIGN KEY ("original_owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
