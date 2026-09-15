# Realtime — Filas, WebSocket, TTS

> Verificado contra o código em 2026-09-02.

## BullMQ

- Conexão global via `REDIS_URL` (`BullModule.forRoot`); filas em `infra/queues/<dominio>/`; processor `@Processor('...') extends WorkerHost`.
- `defaultJobOptions` (todas as filas): `attempts: 3`, backoff exponencial 5s, `removeOnComplete: true`, `removeOnFail: 100`.
- Erro no processor: loga e **re-lança** para erros transitórios (Efí/rede/TTS/R2) — o retry é do BullMQ. Casos definitivos (doação já paga) são resolvidos no processor **sem rethrow**.
- Nomes de fila e job em kebab-case.

| Fila | Job | Produtor |
|---|---|---|
| `donations-queue` | `send-donation` | webhook Efí (doação `pending`) e cron de expiração (vencida que a Efí confirma paga). Options próprias: `attempts: 4`, backoff exponencial 30s |
| email | `send-email` | auth/account-settings (verificação, reset) |

## Pipeline `donations-queue` (processor)

1. Carrega doação — aceita `pending` ou `expired`; inexistente falha; já `paid`/`displayed` loga e **conclui com sucesso** (idempotência de retry).
2. `gateway.getPixStatus` — exige `PAID` e valor igual (compara com `Decimal`).
3. Carrega user + donationSettings + widget overlay ativo (`UsersRepository.findByIdWithConfig`) — overlay é **opcional**: streamer sem widget ativo segue o pipeline (o TTS usa `speakNameAmount: true` como padrão).
4. Moderação IA (`AiContract.cleanMessage`): **chamada comentada** no processor — hoje `message = messageRaw`. `filterProfanity`/`filterSpam`/`blockedWords` só surtem efeito quando reativada.
5. TTS (best-effort): prefixo opcional `"<nome> mandou R$<valor>: "` (se `speakNameAmount` do widget); voz do `voiceId` da doação roteada por `voice.provider` (`SpeechService`: `google` → Google/MP3, demais → Gradium/WAV; texto vazio pula o TTS). Falha de TTS/upload gera `warn` e credita **sem áudio** (`voiceUrl` null) — pagamento confirmado nunca fica sem crédito por falha de áudio.
6. Upload R2 com chave `tts/<username>-<donationId>.wav` — no DB vai só a chave; URL = `BUCKET_URL/<key>` montada em runtime.
7. `DonationsRepository.processDonation` (tx: `paid` + crédito no ledger).
8. Dashboard gateway emite `donation:created`; `OverlayService.handleNewDonation` enfileira o alerta — sem widget configurado ou com overlay offline, a doação segue paga/creditada e a etapa é apenas pulada.

## Cron de expiração (`DonationsService.expireOverdueDonations`, 5min)

O webhook consumido é só de **Pix recebido** — expiração não dispara evento, e cobrança vencida segue `ATIVA` na Efí (não há status EXPIRADA na cob v2). A expiração é decisão local via `expiredAt`:

- Vencidas há +48h → `expired` direto, sem consulta.
- Vencidas há 5min–48h → consulta `getPixStatus`: `CONCLUIDA` → reenfileira como pagamento (webhook perdido); `ATIVA` → `expired`; **erro de consulta → adia para o próximo tick** (400 transitório já atingiu cobrança paga — nunca expirar por falha de consulta).

Detalhes e decisão em `docs/plans/2026-09-05-donation-expiry-and-retry.md`.

## email-queue

Templates Handlebars em `src/templates/emails/*.hbs` (`verify-email`, `forgot-password`); envio via Resend (`RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`).

## WebSocket (Socket.IO)

Emitir de processors/serviços de domínio — nunca de controllers HTTP. Eventos em `snake_case`; sem throttling de WS (o ThrottlerGuard padrão é HTTP-only — throttle de mensagens exigiria guard custom).

| Gateway | Namespace | Auth na conexão | Sala | Emite | Escuta |
|---|---|---|---|---|---|
| `OverlayGateway` | `/overlay` | `query.token` validado no DB (widget ativo) | `token` | `new_donation`, `skip_alert`, `pause_alerts`, `resume_alerts`, `clear_alerts`, `settings_updated` | `alert_finished`, `heartbeat_pulse` |
| `DashboardGateway` | `/dashboard` | `handshake.auth.token` decodificado com `jwt.decode` (**sem verificar assinatura/expiração** — caveat conhecido) | `userId` | `queue_sync`, `overlay_status`, `donation:created`, `donation:updated` | — |

## Motor da fila de alertas (`modules/widgets/overlay.service.ts`)

- **Enfileirar**: só se overlay online (`overlay:<token>`); `RPUSH` do id; sincroniza dashboard; tenta despachar.
- **Dispatch gate** (`dispatchIfReady`): widget ativo + não pausado + `overlay:current` inexistente (claim via `setIfNotExists`). Se perder a corrida, o id volta pro início da fila (`LPUSH`).
- **`dispatchNextAlert`**: `LPOP`; `test-<uuid>` vira payload sintético em memória (nome LinkPix, R$8,43); id sem doação no DB é descartado silenciosamente (self-healing).
- **`alert_finished`**: marca `displayed` (exceto test), apaga `overlay:current`, `dispatchIfReady` — é o único avanço normal da fila.
- **Pausa** (`POST /overlay/toggle-pause`): persiste `settings.isPaused`, emite `pause_alerts`, limpa `overlay:current`. Retomar: `resume_alerts` + `dispatchIfReady`.
- **Skip**: emite `skip_alert`, limpa `overlay:current`; pausado → descarta o próximo da cabeça; ativo → `dispatchNextAlert`. Skip nunca despausa.
- **Extras**: `DELETE /overlay/queue` (limpa tudo), `DELETE /overlay/queue/:donationId`, `POST /overlay/replay/:donationId` (RPUSH + dispatch), `POST /overlay/test` (enfileira `test-<uuid>`).
- **Reconexão**: revalida token, liga online flag, socket dá `join` na sala **antes** de qualquer emit, reemite payload de `overlay:current`, dispara `dispatchIfReady` (autoplay da fila pendente se despausado e sem current) e `queue_sync`.
- **`queue_sync`** espelha a ordem: posição 0 = em exibição (`isCurrent: true`), resto na ordem do Redis; toda dispatch (mesmo fila vazia) reemite o snapshot.
