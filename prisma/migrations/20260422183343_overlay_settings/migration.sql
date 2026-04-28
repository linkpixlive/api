-- CreateTable
CREATE TABLE "overlay_settings" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "max_length" INTEGER NOT NULL DEFAULT 250,
    "volume" INTEGER NOT NULL DEFAULT 100,
    "speak_name_amount" BOOLEAN NOT NULL DEFAULT true,
    "min_audio_amount" DECIMAL(12,2) NOT NULL DEFAULT 5.00,
    "min_text_amount" DECIMAL(12,2) NOT NULL DEFAULT 1.00,
    "default_narrator" VARCHAR(50) NOT NULL DEFAULT 'Ricardo',
    "filter_profanity" BOOLEAN NOT NULL DEFAULT true,
    "filter_spam" BOOLEAN NOT NULL DEFAULT true,
    "blocked_words" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overlay_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "overlay_settings_user_id_key" ON "overlay_settings"("user_id");

-- AddForeignKey
ALTER TABLE "overlay_settings" ADD CONSTRAINT "overlay_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
