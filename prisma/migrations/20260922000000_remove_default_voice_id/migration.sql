-- Voz padrão do narrador passa a viver só no widget de overlay
-- (settings.defaultNarrator, com fallback DEFAULT_VOICE_ID no processor);
-- DonationSettings.defaultVoiceId era fonte dupla de verdade e nunca foi lida
-- no pipeline de TTS.

ALTER TABLE "donation_settings" DROP CONSTRAINT "donation_settings_default_voice_id_fkey";

ALTER TABLE "donation_settings" DROP COLUMN "default_voice_id";
