-- CreateTable
CREATE TABLE "voices" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "voice_id" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "photo_uri" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voices_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "donation_settings" ADD COLUMN "default_voice_id" VARCHAR(36);

-- AlterTable
ALTER TABLE "donations" ALTER COLUMN "voice_id" SET DATA TYPE VARCHAR(36);

-- AddForeignKey
ALTER TABLE "donation_settings" ADD CONSTRAINT "donation_settings_default_voice_id_fkey" FOREIGN KEY ("default_voice_id") REFERENCES "voices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_voice_id_fkey" FOREIGN KEY ("voice_id") REFERENCES "voices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
