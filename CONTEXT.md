# CONTEXT.md — Produto e domínio

> Verificado contra o código em 2026-09-02.

## Produto

**LinkPix** (nome legado: **Tipply** — ambos aparecem no código/docs) é uma plataforma brasileira de doações para lives: o streamer se cadastra, configura overlay e chaves Pix; o espectador doa via Pix com mensagem opcional, transformada em áudio TTS; o alerta aparece no overlay em tempo real e o valor cai na carteira do streamer, sacável via Pix com taxa e aprovação administrativa.

**Stack:** NestJS 11 (Express) · Prisma 7 + PostgreSQL (driver adapter) · Redis (ioredis) · BullMQ · Socket.IO · Swagger em `/api/docs` (fora de produção). Docker local: Postgres **5433**, Redis **6380**.

## Módulos (`src/modules/`)

| Módulo | Responsabilidade |
|---|---|
| `auth` | registro/login (JWT + sessão Redis), verificação por OTP, reset de senha, 2FA, cleanup de contas não verificadas (cron 30min) |
| `account-settings` | troca de email/senha/nome, desativação, setup/enable/disable de 2FA |
| `profile` | troca de username (cooldown 15 dias; blacklist permanente se verificado, senão 60 dias) |
| `pix-keys` | CRUD de chaves Pix (criptografadas, dedupe por hash, limite por env) |
| `wallets` | saldo (disponível/pendente/bloqueado); reconciliação diária 3h |
| `withdrawals` | solicitação de saque (idempotência via `clientKey`, taxa), listagem paginada |
| `donations` | lookup público do streamer (`GET /user/:username`) e criação de doação com Pix (`POST /donation`) |
| `donation-settings` | regras por streamer: `maxLength`, mínimos audio/texto, filtros, palavras bloqueadas, voz padrão |
| `widgets` | CRUD de widgets overlay/qrcode + token; **motor da fila de alertas** (`overlay.service`) |
| `webhooks` | `POST /webhook/pix` (Efí) — roteia doações e saques |
| `dashboard` | estatísticas 30 dias + histórico paginado (busca por nome/mensagem) |
| `admin` | `@Roles(admin)`: verificar usuários, aprovar/rejeitar saques; CRUD de vozes em `admin/voices` |
| `voices` | catálogo de vozes TTS (consumido pelo pipeline de doações) |
| `health` | `GET /health` (liveness simples) |

## Fluxo da doação (ponta a ponta)

1. Espectador: `GET /user/:username` (público) → dados do streamer + mínimos; `POST /donation` (público, throttled) → valida voz/mínimos/comprimento → `gateway.generatePix` → doação `pending` com código Pix.
2. Efí confirma → `POST /webhook/pix` → enfileira `{donation_id}` em `donations-queue`.
3. Processor (ver `docs/realtime.md`): verifica pagamento → TTS → upload R2 → doação `paid` + crédito no ledger → WS `donation:created` → enfileira alerta no overlay.
4. Overlay exibe; cliente emite `alert_finished` → status `displayed` → próxima da fila.

## Ciclo de saque

`POST /withdrawals` → valida mínimo/taxa (`WITHDRAWAL_FEE_PERCENTAGE`) → `pending` + ledger `withdraw_reserve` → admin aprova → envio Pix (em dev, destino forçado `efipay@sejaefi.com.br`) → scheduler (5min) ou webhook confirma (`success` + `withdraw_confirm`) ou rejeita (`failed` + `refund`).

## Glossário

- **Overlay**: página do OBS que exibe alertas; identificada pelo `token` do widget (UUID).
- **Ledger**: tabela `transactions` (append-only); saldo do wallet é cache derivado dela.
- **`messageRaw` vs `message`**: texto original do doador vs texto tratado (hoje cópia direta — moderação IA desativada).
- **Test alert**: `test-<uuid>` na fila; payload sintético em memória, nunca persistido.
- **MED**: disputa de Pix (plano em `docs/plans/2026-08-12-med-and-fee-ledger.md`).

## Status

- **Implementado**: tudo acima, incluindo trigger de ledger e reconciliação.
- **Planejado** (ver `docs/plans/`): MED/fee ledger, ativação de `blockedBalance`, `TransactionType.fee`.
- **Spec ativa**: histórico "Ao Vivo" unificado (`docs/specs/2026-08-27-historico-ao-vivo-donations.md`).
