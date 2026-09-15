-- Moderação IA de doações por streamer (docs/plans/2026-09-15-ai-moderation-filters.md).

-- O texto final da doação passa a nascer em "message" (a moderação acontece na
-- submissão, antes do QRCode). "message_raw" era do modelo antigo de rewrite
-- pós-pagamento — preservar o texto das doações ainda não pagas antes do drop.
UPDATE donations SET message = COALESCE(message, message_raw);

ALTER TABLE "donations" DROP COLUMN "message_raw";

-- Toggle mestre da moderação IA + novos filtros; "blocked_words" (array) é
-- substituída por "custom_rules" (input único do streamer: palavras e/ou contexto).
ALTER TABLE "donation_settings"
  ADD COLUMN     "ai_moderation"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "filter_hate_speech"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "custom_rules"        TEXT NOT NULL DEFAULT '',
  DROP COLUMN    "blocked_words";
