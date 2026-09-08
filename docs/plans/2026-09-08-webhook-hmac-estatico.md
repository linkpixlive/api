# 2026-09-08 — Webhook Pix: volta ao HMAC estático (compatível Efí)

## Problema

`POST /webhook/pix` (`src/modules/webhooks/webhooks.controller.ts`) passou a exigir
`?hmac = hex(HMAC_SHA256(secret, rawBody))` (commit `a0c9a8e`). A Efí não computa
assinatura por payload — só ecoa a string estática cadastrada na URL do webhook
([docs Efí, "Utilizando HMAC na URL"](https://dev.efipay.com.br/docs/api-pix/webhooks/)).
Resultado: todo callback real da Efí retornava `401 Assinatura HMAC inválida`.

## Decisão

Reverter para segredo compartilhado estático (`?hmac=` comparado a
`EFI_WEBHOOK_SECRET` com `timingSafeEqual`), comportamento original (`89d8a55`).
Bloqueio por IP avaliado e **descartado por agora** (decisão do dono em 2026-09-08).

## Mudanças

- `src/modules/webhooks/webhooks.controller.ts`
  - Removido `req: RawBodyRequest<Request>` do handler e checagem de `rawBody`.
  - `isValidSignature(hmac, rawBody)` → `isValidSecret(hmac)`: comparação
    timing-safe direta contra `EFI_WEBHOOK_SECRET`.
  - Imports limpos (`createHmac`, `Req`, `RawBodyRequest`, `Request` removidos).
  - Intactos: `@Public()`, `@Throttle` (20/min), cap de batch 5, roteamento
    `gnExtras.idEnvio` → saque / `txid` → doação, retorno `'ok'`.
- `docs/security.md`: seção do webhook documenta o formato estático + operacional
  de cadastro na Efí (URL base, sufixo `/pix` automático, truque `&ignorar=`).
- Sem mudança de env: `EFI_WEBHOOK_SECRET` já obrigatório
  (`env.validation.ts`, `.env.example`). `main.ts` (`rawBody: true`) mantido.

## Rollout (pós-deploy)

1. `openssl rand -hex 32` → `EFI_WEBHOOK_SECRET` (prod).
2. `PUT /v2/webhook` (escopo `webhook.write`):
   `{ "webhookUrl": "https://<api>/webhook?hmac=<segredo>" }`.
3. Efí chama `POST .../webhook/pix?hmac=<segredo>`; confirmar `200`.

## Verificação

- `pnpm build` + `pnpm lint`.
- curl: sem `?hmac=` → `401`; `?hmac=errado` → `401`;
  `?hmac=<segredo>` + `{ "pix": [] }` → `200`; batch com 6 itens → `400`.

## Riscos

- Segredo estático na URL pode vazar em logs/proxies (cf.
  `docs/audits/withdrawals-pix-keys-vulnerabilities.md`). Mitigação real
  (mTLS no proxy / IP allowlist) é follow-up de infra, fora deste escopo.
