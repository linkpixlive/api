UPDATE donation_settings
SET
  min_audio_amount = LEAST(GREATEST(min_audio_amount, 1), 999999.99),
  min_text_amount = LEAST(GREATEST(min_text_amount, 1), 999999.99)
WHERE min_audio_amount < 1
   OR min_audio_amount > 999999.99
   OR min_text_amount < 1
   OR min_text_amount > 999999.99;
