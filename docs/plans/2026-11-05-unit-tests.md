# Plano: introdução de testes unitários — LinkPix API

**Data:** 2026-11-05 · **Status:** implementado (Fase 0 + Fase 1 da avaliação de 2026-09-02)

## Contexto

A verificação do projeto era só `pnpm build` + `pnpm lint` — nenhuma pega regressão de comportamento em lógica financeira (ledger, taxas, idempotência), de segurança (webhook Efí) e de fila. O stack já estava instalado (Jest 30 + ts-jest + `@nestjs/testing`) e o job `quality` do CI já rodava `pnpm test` vazio (`--passWithNoTests`). Este plano executa a Fase 0 remanescente e a Fase 1 (P0: dinheiro/segurança) da [avaliação de testes](../audits/2026-09-02-unit-tests-assessment.md), remapeada para os nomes de arquivo atuais.

## Convenções estabelecidas

- **Unit specs colados ao código**: `src/<caminho>/<arquivo>.spec.ts` — o jest config (`rootDir: src`, `testRegex: .*\.spec\.ts$`) já espera isso; build os exclui via `tsconfig.build.json`.
- **E2E** permanece em `test/*.e2e-spec.ts` com `test/jest-e2e.json`.
- **Env dummies**: `test/setup-env.ts` via `setupFiles` (valores estáticos; specs não dependem de `.env`). Só defina lá o que é lido de `process.env` ou na instanciação; dependências de `ConfigService` são mockadas no spec.
- **Fakes inline** em cada spec. Extrair para pasta compartilhada só se ≥3 specs duplicarem o mesmo fake.
- **Contratos** (`GatewayContract` etc.) mockados pela classe abstrata; DI por construtor permite `new Service(fake1, fake2, ...)` sem `Test.createTestingModule`.
- `clearMocks: true` global.

## Cobertura implementada (15 suites, 166 testes)

**Utils puras (zero mocks):**
- `mask.util.spec` — mascaramento por tipo de chave Pix + fallbacks
- `crypto.util.spec` — round-trip AES-256-GCM, tamper, `hashData`, validação de `ENCRYPTION_KEY`
- `custom-rules.util.spec` — normalização (acentos/leet/char-runs), fronteira, mesclagem
- `spam-sanitizer.util.spec` — colapso de runs/fragmentos, keyboard mash
- `history-retention.util.spec` — janelas de retenção com `from` injetável
- `moderation-policy.spec` — prompt por filtros ativos, parse tolerante com whitelist, fail-open
- `env.validation.spec` — schema de env (formatos, faixas, coerção numérica)
- `redis-keys.spec` — builders de chave + TTLs
- `is-pix-key.decorator.spec` — CPF/CNPJ/telefone/email/UUID
- `audio-extension.util.spec` — regra google→mp3/wav (extraída nesta rodada; deduplicava 3 pontos)

**Núcleo dinheiro/segurança (mocks leves):**
- `webhooks.controller.spec` — hmac timing-safe, cap de batch 5, roteamento idEnvio/txid
- `withdrawals.service.spec` — taxa/net com `Decimal`, mínimo, idempotência `clientKey` (incl. corrida P2002), posse da chave Pix, `handleWebhookPixSend` (UUID de 32-hex, branch approve/reject/fail, transactionId divergente)
- `donations.repositories.spec` — `processDonation`: transição guardada pending/expired→paid, `count 0` → idempotente/NotFound, crédito na mesma tx
- `withdrawals.repositories.spec` — máquina de estados com `updateMany` guardado, refund/confirm via `WalletsRepository`
- `wallets.repositories.spec` — saldo derivado do `balanceAfter` do ledger (nunca do cache), saldo negativo rejeitado, math de `pendingBalance` nas 4 ops, `reconcile` (cadeia válida/quebrada/cache divergente/paginação)

## Fora de escopo desta rodada (próximas)

> Sequenciamento da próxima rodada planejado em [2026-11-05-unit-tests-rodada-2-pipeline-doacoes.md](2026-11-05-unit-tests-rodada-2-pipeline-doacoes.md) (pipeline de doações — **ainda não implementado**).

- **Mocking pesado:** `overlay.service` (máquina de estados da fila, 8 deps), `donations-queue.processor` (pipeline TTS), `auth.service`, `account.service`.
- **Fase 2 — integração com Postgres real:** atomicidade de `$transaction`, `FOR UPDATE`, trigger `wallets_balance_guard`. Os unit tests de `applyOp` pinam a lógica de decisão, não a atomicidade.
- Extrações futuras: `detectKeyType`/`stripPhoneDdi` (pix-keys), mappers do Efí.
- **Não vale unit:** CRUDs finos, controllers que só delegam, providers de IO puro (speech/R2/email), `dashboard.service` (lógica é SQL no repository).
