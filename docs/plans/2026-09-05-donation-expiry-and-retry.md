# Plano — Expiração de doações e retry do pipeline

> Data: 2026-09-05 · Status: aprovado
> Par: plano frontend `linkpix-frontend/docs/plans/2026-09-05-donation-failure-states.md`

## Problema

- Doação expirada sem pagamento fica `pending` para sempre: o webhook consumido (`POST /webhook/pix`) é o de **Pix recebido** — expiração não dispara evento.
- Processor sem retry: erro transitório (TTS/R2/rede) abandona doação **paga** em `pending` (visto 3x em 2026-09-05: overlay ausente, wallet ausente).
- Job de doação já processada lança BadRequest em vez de concluir (idempotência quebra com retry).
- Consulta Efí 4xx (caso `016d4b3f`: verificada como paga às 14h00, 400 nas re-verificações) falha o job sem tratamento.

## 1. Cron de expiração (DonationsService, `@Cron` a cada 5 min)

- `DonationsRepository.findOverdue(expiredBefore, limit)` — pending com `expiredAt < expiredBefore`; `expireOverdue(expiredBefore)` (updateMany guardado em `pending`) e `updateStatus(id, 'expired')`.
- Threshold duro (48h): `expiredAt < now - 48h` → `expired` direto, sem consulta.
- Vencidas recentes (5min–48h), por doação: `getPixStatus` → `CONCLUIDA` enfileira na `donations-queue` (pagamento com webhook perdido não se perde); `ATIVA` (não paga) → `expired`; **qualquer erro de consulta → pula esta rodada** (nunca expirar por falha de consulta — ver §4).
- Constantes no código (sem env nova). Loga total expirado.

## 2. Processor

- `getDonation` aceita `pending` ou `expired`; já `paid`/`displayed` → log e conclusão com sucesso (idempotência de retry).
- `processDonation` permite `pending|expired → paid`.
- `verifyPaymentStatus`: qualquer erro de consulta à Efí → rethrow (retry — o 400 transitório provou que não é sinal de expiração).

## 3. Retry BullMQ

- `sendDonation`: `attempts: 4`, backoff exponencial 30s. Rethrow apenas para transitórios.

## 4. Investigação 400 Efí (`016d4b3f`) — CONCLUÍDA (2026-09-05)

- Replicação de `GET /v2/cob/{txid}`: `016d4b3f` responde **HTTP 200 / `CONCLUIDA`** (R$2,32) — a cobrança estava paga; o 400 dos jobs 2/5 foi **transitório**.
- Cobrança expirada-não-paga permanece `ATIVA` na Efí (não há status EXPIRADA na cob v2).
- **Consequências no desenho:** (1) falha de consulta à Efí é sempre transitória → rethrow/retry, nunca expira por erro de consulta; (2) a decisão de expirar é local (`expiredAt`); a consulta no cron serve apenas para capturar pagamento com webhook perdido (`CONCLUIDA` → enfileira).

## 5. Docs

- `docs/realtime.md` (cron, retry, rethrow) e `CONTEXT.md` (estado `expired` no ciclo da doação).

## Verificação

- `pnpm build && pnpm lint`.
- Smoke: vencida → `expired`; vencida paga → enfileirada → `paid` sem crédito duplo; falha transitória → retry.
