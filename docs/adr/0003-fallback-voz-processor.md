# 0003 — Voz do TTS resolvida no processor, com fallback até o provider

- **Status:** accepted
- **Data:** 2026-09-22

## Contexto

A voz do alerta era definida em dois lugares concorrentes (`DonationSettings.defaultVoiceId`, nunca lido no pipeline, e `overlay.settings.defaultNarrator`, o efetivo) e conta nova nascia sem narrador válido (`defaultNarrator: ''`). Semear uma voz por conta exigiria backfill e migração a cada troca de padrão.

## Decisão

- Fonte única configurável: `overlay.settings.defaultNarrator` (vazio = "Voz padrão"); `DonationSettings.defaultVoiceId` foi removido (migration `20260922000000_remove_default_voice_id`).
- Cadeia no `DonationsQueueProcessor.generateAndUploadAudio`: **`voiceId` da doação (doador) → `defaultNarrator` do streamer → `DEFAULT_VOICE_ID` (env, sistema) → default do provider** (Gradium `YHOBjtajNBEHUI_K`, Google `pt-BR-Wavenet-A). Cada nível ausente/inativo cai para o próximo com `warn`; a doação nunca falha por causa de voz.
- Áudio de teste do overlay (`OverlayService.testOverlay`): arquivo fixo gerenciado pelo sistema (`tts/test-<DEFAULT_VOICE_ID>.mp3|wav`, extensão por provider), sempre na voz do sistema. Existe → reutiliza; falta → gera uma vez (memo em memória; regenera sozinho se o lifecycle do R2 apagar).

## Consequências

- Trocar a voz padrão do sistema = mudar env, sem backfill; quem setou narrador explícito mantém o seu.
- `defaultNarrator` não-vazio é validado (existe + ativo) no update do overlay; vazio é sempre válido.
