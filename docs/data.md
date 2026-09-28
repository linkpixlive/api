# Dados — Prisma & Redis

> Verificado contra o código em 2026-09-24.

## Prisma 7

- Postgres via driver adapter (`@prisma/adapter-pg`); URL vem de `DATABASE_URL` em `prisma.config.ts` (o schema não tem `url`).
- Migrations: `pnpm db:migrate` (dev — cria migration + gera client) / `pnpm db:deploy` (prod — aplica pendentes). Client gerado em `generated/prisma`.
- Tabelas snake_case via `@@map`; índice obrigatório em todo campo usado em `where`/`orderBy`.
- Prefira os enums do `@prisma/client` a strings soltas.

### Models (12)

| Model | Papel |
|---|---|
| `User` | streamer/admin; cpf + `cpfHash`; TOTP; roles `[streamer]` |
| `UsernameBlacklist` | usernames de donos que trocaram (permanente se verificado, 60 dias senão) |
| `Wallet` | 1:1 user; `currentBalance`/`pendingBalance`/`blockedBalance`; `lastTransactionId` (ponteiro do ledger, FK p/ `transactions.id`) |
| `PixKey` | chave criptografada + `keyHashed` (única por user) + `keyMasked` |
| `Voice` | catálogo TTS (admin) |
| `Donation` | `message` único (texto final — moderação na submissão); `transactionId` único; `pix`; status |
| `Withdrawal` | gross/net/fee; `clientKey` (idempotência, único por user); `pixValue` |
| `Transaction` | ledger append-only; `balanceAfter` derivado da entrada anterior |
| `ChangePassword` | tokens de reset hasheados com expiração |
| `GatewayResponse` | auditoria de toda chamada Efí |
| `DonationSettings` | `maxLength`, mínimos, moderação IA (`aiModeration`, filtros, `customRules`), `defaultVoiceId` |
| `Widget` | overlay/qrcode; `settings` Json; `token` UUID único |

### Enums (10)

`UserRole` (admin, streamer) · `DonationStatus` (pending→paid→displayed; failed, expired) · `PaymentMethod` (pix) · `WithdrawalStatus` (pending, processing, success, failed) · `TransactionType` (donation, withdraw_reserve, withdraw_confirm, refund; `withdrawal` declarado e não usado) · `PixKeyType` (cpf, cnpj, email, phone, random) · `MessageType` (audio, text) · `GatewayProvider` (efi) · `InteractionType` (4 interações Efí) · `WidgetType` (overlay, qrcode)

## Invariantes financeiras (não quebrar)

- **Ledger é a fonte da verdade**: `wallets.currentBalance` é cache derivado de `transactions`.
- Trigger `wallets_balance_guard` (migration `20260811220000_wallet_balance_ledger_trigger`) rejeita UPDATE de `current_balance` que não avance `last_transaction_id`.
- Toda movimentação passa por `WalletsRepository.applyOp`: `SELECT ... FOR UPDATE` → novo saldo derivado da **última entrada do ledger** (nunca do cache) → append no ledger → update do cache. Saldo negativo → `InsufficientBalanceError` (erro de domínio, `wallets.errors.ts`), mapeado para 400 no service do domínio.
- Ops prontas: `creditDonation` (+gross) · `reserveForWithdrawal` (delta −gross, pending +gross) · `confirmWithdrawal` (delta 0, pending −gross) · `refundWithdrawal` (delta +gross, pending −gross). Uma linha de ledger por (`withdrawalId`, `type`) — unique composta `transactions_withdrawal_id_type_key`.
- Doação paga: `DonationsRepository.processDonation` em `$transaction` — guarda `updateMany` pending→paid + crédito no ledger.
- Reconciliação: `reconcile(userId)` valida a cadeia `balanceAfter[i] == balanceAfter[i-1] + amount[i]`, ordenando por `createdAt` + `id` (desempate determinístico) e paginando o ledger por cursor (500/chunk). Cron diário 3h varre wallets em lotes de 100 (instância única, sem lock distribuído).

## Redis

- Sempre via `RedisService` (JSON automático); nunca injete `REDIS_CLIENT` direto.
- API: `setWithExpire`, `setIfNotExists` (SET NX — claims atômicos), `get<T>`, `update` (preserva TTL restante), `remove`, `setExpire`, listas (`addToListEnd`/`addToListStart`, `removeListValue`, `getListRange`…) e sets (sessões).
- **Chave nova** = builder em `src/infra/redis/redis-keys.ts` + TTL em `REDIS_TTL` + linha abaixo. Exceção sem TTL deve estar justificada aqui.

| Builder | Chave | TTL | Uso |
|---|---|---|---|
| `overlayOnline` | `overlay:<token>` | 80s | heartbeat do overlay |
| `overlayQueue` | `overlay:queue:<token>` | — (deliberado) | fila FIFO de ids de doação / `test-<uuid>` |
| `overlayCurrent` | `overlay:current:<token>` | 300s | payload da doação em exibição (claim SET NX; conclusão usa compare-and-delete) |
| `otpVerification` | `otp:verification:<email>` | 600s | OTP de email (hash sha256) |
| `otpVerificationAttempts` | `otp:verification_attempts:<email>` | 600s | tentativas inválidas do OTP de cadastro (INCR atômico) |
| `emailChangeVerification` | `email:change:<userId>` | 600s | OTP + novo email pendente |
| `emailChangeAttempts` | `email:change:attempts:<userId>` | 600s | tentativas inválidas do OTP de email |
| `totpSetup` | `totp:setup:<userId>` | 600s | segredo 2FA pendente (criptografado) |
| `totpSetupAttempts` | `totp:setup_attempts:<userId>` | 600s | tentativas inválidas no `2fa/enable` (INCR atômico) |
| `authPending2fa` | `auth:pending_2fa:<nonce>` | 300s | nonce one-shot do login 2FA |
| `authPending2faAttempts` | `auth:pending_2fa_attempts:<nonce>` | 300s | tentativas inválidas no `login-2fa` (INCR atômico) |
| `session` | `auth:session:<sid>` | TTL = dias do JWT (definido no login) | sessão revogável |
| `userSessions` | `auth:user_sessions:<userId>` | acompanha as sessões | set de sids (logout-all) |
