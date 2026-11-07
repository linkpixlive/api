# Plano: rodada 2 de testes unitários — Pipeline de doações

**Data:** 2026-11-05 · **Status:** proposta — **não implementada** (decisão do usuário: salvar para depois)

## Contexto

A rodada 1 ([2026-11-05-unit-tests.md](2026-11-05-unit-tests.md)) pinou a camada do ledger (`WalletsRepository`, `processDonation`, transições de saque), o webhook Efí e as utils puras (15 suites, 166 testes). A **orquestração acima do ledger segue sem rede**: o processor que decide se um pagamento confirmado vira crédito, o service que valida/modera a doação antes de gerar o Pix, e o gateway cujos mapeamentos de status alimentam essas decisões. É o caminho de entrada de dinheiro — bug aqui = crédito duplo, crédito perdido ou cobrança criada para doação bloqueada.

## Restante por prioridade (depois desta rodada)

1. **Auth/conta** — `auth.service`, `account.service`, `verification.service`, `step-up.util`: cap de 5 tentativas de OTP/TOTP, nonce 2FA one-shot ligado ao userId, sessões revogáveis, anti-timing-oracle no login. Vetor de takeover de conta.
2. **Overlay.service** — máquina de estados da fila de alertas (claim atômico SET NX, requeue, pausa, descarte de IDs stale). Impacto alto de UX, sem perda direta de dinheiro; mock mais pesado (8 deps).
3. **Fase 2 — integração com Postgres real** — atomicidade de `$transaction`, `FOR UPDATE`, trigger `wallets_balance_guard`. Trabalho de infra separado (docker/testcontainers), não é unit.

## Convenções (mesmas da rodada 1)

- Specs colados ao código: `src/<caminho>/<arquivo>.spec.ts`.
- DI por construtor → fakes inline + cast `as never`, **sem** `Test.createTestingModule`.
- `clearMocks: true` global; env dummies em `test/setup-env.ts` (`ENCRYPTION_KEY` 64-hex já disponível para `crypto.util` real).
- Override de `no-unsafe-*` para `**/*.spec.ts` já existe no `eslint.config.mjs`.

## Passos

### 1. `src/infra/queues/donations/donations-queue.processor.spec.ts`

**Construtor (deps em ordem):** `donationsRepository, gateway, usersRepository, storage, speech, overlayService, voiceService, dashboardGateway, configService, donationsQueue` (`@InjectQueue`). Job fake: `{ id, attemptsMade, data: { donation_id } }` (cast `as Job`).

**Mocks especiais:** `jest.mock('../sleep-on-idle')` — WeakMap module-level, e `onApplicationBootstrap` chama com `this.worker` que é `undefined` em unit test. `DonationHistoryEntity.fromDonation` e `audio-extension.util` ficam **reais** (puros). Contracts (`GatewayContract`, `SpeechContract`, `StorageContract`) via fake da classe abstrata.

**Casos:**

- Happy path: ordem `verifyPaymentStatus` → `processDonation` → `dashboardGateway.emitDonationCreated` → `overlayService.handleNewDonation`; `voiceUri` = `tts/<username>-<donation.id>.<ext>`
- Não-PAID → `BadRequestException` e `processDonation` nunca chamado
- `paidAmount` diferente do `amount` → BadRequest; igual em representação (`'10.00'` vs `'10'`) → passa (pina `Decimal.equals`, não `===`)
- Doação já `paid` → `process` no-op sem tocar gateway/users (idempotência de retry); doação inexistente → BadRequest
- Fallback de voz em 3 níveis, cada um com catch silencioso: `donation.voiceId` → `defaultNarrator` do overlaySettings → `DEFAULT_VOICE_ID` (config, só se truthy) → `voice = undefined` → provider undefined → `.wav`
- `speakNameAmount: true` → prefixo `` `${nome.trim() || 'Anonimo'} mandou R$${amount}: ` ``; `false` → sem prefixo
- Fail-open de TTS: `speech.generateTTS` rejeita → `processDonation` com `voiceUri: null` e evento emitido (crédito nunca depende do áudio); upload não chamado
- Mensagem vazia sem speakNameAmount → retorna null sem chamar speech
- `onApplicationBootstrap` delega ao módulo mockado (`sleepOnIdle(worker, cb)`)

### 2. `src/modules/donations/donations.service.spec.ts`

**Construtor (deps em ordem):** `usersRepository, donationsRepository, gateway, donationsQueue (DonationsQueueService), redisService, voicesRepository, ai (AiContract), storage`.

**Mocks:** fakes dos 8 deps. Utils de moderação (`spam-sanitizer`, `custom-rules`) e `history-retention` ficam **reais** — integração barata entre utils e service. `xss` real. Constantes do arquivo: `EXPIRY_MARGIN_MS = 5min`, `HARD_EXPIRY_MS = 48h`, `OVERDUE_BATCH_LIMIT = 50`, `BLOCKED_MESSAGE`.

**Casos:**

- `donation`: voz inexistente/inativa → BadRequest e `generatePix` não chamado; usuário inativo/não verificado → NotFound
- `donation`: mensagem acima de `Math.min(settings.maxLength, 250)` → BadRequest com o limite; `amount < minTextAmount` via Decimal (9.99 vs 10.00) → BadRequest
- `donation`: regra custom bloqueia → `BLOCKED_MESSAGE` e `generatePix`/`create` não chamados; IA bloqueia → BadRequest; IA permite → `create` recebe pix + name/message (sanitizados se `filterSpam`)
- `donation`: `generatePix` → null → BadRequest (rejeição nunca cria cobrança)
- `webhookPix`: `pending`/`expired` → enfileira; `paid` → **não** enfileira; inexistente → NotFound com txid na mensagem
- `expireOverdueDonations` (cron 5min): PAID → re-enfileira e NÃO expira (`requeued`); não-pago → `expireById` (`expired`); `getPixStatus` lança → adia (warn) e continua o loop; pinar janelas: `expireOverdue` chamado com now−48h, `findOverdue` com now−5min e limit 50
- `getDonationAudio`: `isOlderThanRetention` (30d) → `GoneException`; sem `voiceUrl` → NotFound; `storage.getObject` lança → NotFound; filename `doacao-<slug>-<stamp>.<ext>` com slug normalizado ('Joãoãoão!!' → 'joaoaoao'); contentType fallback por extensão `.mp3`
- `getUser`: inativo/não verificado → NotFound; `maxLength` clampado em 250; `overlayActive` via `redisService.get(RedisKeys.overlayOnline(token))`

### 3. `src/infra/gateway/Efi/efi.service.spec.ts`

**Construtor:** `configService` (fake), `httpService` (mock de `get/post/put` retornando Observable real via `of({ data, status })` do rxjs — o service usa `firstValueFrom`), `gatewayResponseRepository` (fake `create`). Instanciação direta ok: o construtor só cria `https.Agent` com config fake (Buffer vazio).

**Casos:**

- Cache de token: 2 chamadas seguidas → 1 POST `/oauth/token`; `tokenExpiresAt` com margem < 60s → refresh; header Basic = `base64(clientId:clientSecret)` e `grant_type: client_credentials`
- `generatePix`: corpo correto (`valor.original = '10.00'`, `expiracao` do config), `expiredAt = criacao + expiracao*1000` exato, persistência `GENERATE_DONATION_QRCODE`
- `getPixStatus`: `'ATIVA'`→PENDING; `'CONCLUIDA'`→PAID + `paidAmount` Decimal; `'REMOVIDA_PELO_USUARIO_RECEBEDOR'`/`'REMOVIDA_PELO_PSP'`→FAILED; desconhecido→PENDING; `'CONCLUIDA'` sem `valor.original` → PAID **sem** `paidAmount` (processor pula a comparação)
- `sendPix`/`getSentPixStatus`: `'REALIZADO'`/`'CONCLUIDO'`→SUCCESS com `transactionId = e2eId`; `'NAO_REALIZADO'`/`'REJEITADO'`→FAILED; default→PROCESSING

## Verificação (quando implementado)

1. `pnpm test` — 18 suites verdes (~195 testes)
2. `pnpm build` — specs fora do dist
3. `pnpm lint:ci` — limpo
4. CI: job `quality` roda `pnpm test` automaticamente no PR
