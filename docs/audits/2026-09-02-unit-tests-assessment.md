# Avaliação: testes unitários no LinkPix API

**Data:** 2026-09-02 · **Tipo:** relatório de avaliação + roadmap · **Status:** proposta (nenhum código alterado)

## Veredito

Vale a pena e é viável com esforço baixo de setup. O código já nasceu test-friendly:

- **DI por construtor em todas as camadas** — qualquer service/repository/processor é instanciável com fakes, sem mágica.
- **Prisma confinado a `src/infra/db/`** — nenhum service ou controller toca o client direto; a costura de mock é única.
- **Redis só via `RedisService`** e chaves via builders puros em `src/infra/redis/redis-keys.ts`.
- **Integrações externas atrás de contracts** (`GatewayContract`, `SpeechContract`, `StorageContract`, `AiContract`) — injeta-se a abstração, nunca o SDK.
- **O stack de teste já está instalado** (Jest 30, ts-jest, `@nestjs/testing`, supertest no `package.json`) — falta configurar e escrever os testes.

A necessidade é real, não cosmética: existe lógica financeira (ledger, taxas, idempotência), lógica de segurança (2FA, sessões, OTP) e uma máquina de estados de fila (overlay) que hoje só têm como verificação `pnpm build` + `pnpm lint` — nenhuma das duas pega regressão de comportamento.

## Estado atual da tooling

O `package.json` já tem scripts (`test`, `test:watch`, `test:cov`, `test:e2e`) e o bloco `jest` (`rootDir: "src"`, `testRegex: .*\.spec\.ts$`, ts-jest). Zero arquivos `*.spec.ts` no projeto. Três fricções impedem o primeiro teste de rodar:

| # | Fricção | Detalhe |
|---|---|---|
| 1 | **Imports `src/...` não resolvem** | O código importa por caminho absoluto lógico (ex.: `src/modules/withdrawals/withdrawals.service.ts:8` → `'src/common/interfaces/sent-pix-status.type'`). O `tsconfig.json` não tem `paths` e o bloco `jest` não tem `moduleNameMapper` — o resolver padrão do Jest quebra em qualquer spec que toque nesses arquivos. Correção: `moduleNameMapper: { '^src/(.*)$': '<rootDir>/$1' }`. |
| 2 | **Versão desalinhada ts-jest vs Jest** | `ts-jest ^29.2.5` declara peer `jest ^29`; o projeto usa `jest ^30`. Alinhar (bump ts-jest ≥ 29.4, que suporta Jest 30, ou fixar Jest 29) e confirmar com um run. |
| 3 | **`pnpm test` hoje falha** | Sai com erro "No tests found" — sem `--passWithNoTests` e sem nenhum spec, o script é atualmente um ponto vermelho permanente (também já mapeado em `docs/plans/2026-09-02-ci-cd-pipeline.md`). |

Fricções menores:

- `src/common/security/security.service.ts` lê `process.env.ENCRYPTION_KEY` **na instanciação** (violação pontual do invariante ConfigService) — qualquer teste que instancie a classe sem a env var explode. Solução: `setupFiles` do Jest com dummies (`ENCRYPTION_KEY` hex de 64 chars, `BUCKET_URL`, `REDIS_URL`).
- `test/app.e2e-spec.ts` é scaffold morto (espera `GET /` → "Hello World!", rota que não existe) — remover ou reescrever; enquanto isso, `--passWithNoTests` no `test:e2e`.
- `bcryptjs` e `verifySync` do otplib são importados direto (não injetáveis) — exigem `jest.mock` pontual; bcryptjs com cost 12 real deixa o teste lento (~100ms+ por hash).
- `AppModule` constrói `ThrottlerStorageRedisService(process.env.REDIS_URL)` e `BullModule.forRoot` inline — só importa para quem for bootar o app inteiro (e2e), não para testes unitários.

## Benefícios concretos

1. **Correção financeira.** É o código onde bug custa dinheiro real e é silencioso. Exemplos que só testes fixam:
   - `withdrawals.service.ts:71-72` calcula taxa com float: `+(dto.amount * (feePercentage / 100)).toFixed(2)` — vale pinar casos de borda (centavos, percentuais não inteiros) antes de alguém "refatorar" e mudar arredondamento.
   - `wallets.repositories.ts` `applyOp` deriva o novo saldo do `balanceAfter` da **última entrada do ledger** (nunca do cache da wallet) e rejeita saldo negativo — são exatamente os invariantes que um refator descuidado quebraria sem compilar errado.
   - Idempotências: `clientKey` de saque, `processDonation` (transição `pending → paid` guardada por `updateMany`).
2. **Loop de verificação para agentes.** O workflow do repo é fortemente orientado a agentes (`AGENTS.md`, plans, issues). Hoje o sinal de "não quebrei nada" é só build+lint. Testes dão sinal semântico rápido e encaixam direto no job `test` já previsto no plano de CI (`docs/plans/2026-09-02-ci-cd-pipeline.md`).
3. **Documentação viva das regras de negócio.** As transições de saque (`pending → processing → success/failed`, com refund) e a máquina de estados da fila do overlay estão hoje só no código; um spec por transição é documentação que não apodrece.
4. **Refatoração segura.** Os plans recentes mostram churn constante em auth/ledger/hardening; testes permitem mudar com rede.
5. **Proteção contra regressões sutis no overlay.** A lógica de claim atômico (`SET NX`), requeue, pausa e limpeza de entradas stale é fácil de quebrar de forma não-óbbvia. Hoje a única verificação é o script manual `scripts/test-overlay-queue.ts`, que exige infra de pé.

## Inventário por criticidade

### P0 — dinheiro e segurança (testar primeiro)

| Alvo | O que tem de lógica real |
|---|---|
| `src/infra/db/repositories/wallets.repositories.ts` | `applyOp` (lock `FOR UPDATE`, deriva saldo do ledger, rejeita negativo, math de `pendingBalance`), `reconcile` (valida cadeia `balanceAfter[i] == balanceAfter[i-1] + amount[i]` vs cache) |
| `src/infra/db/repositories/withdrawals.repositories.ts` | State machine em `$transaction` com `updateMany` guardado: `processWithdrawal`, `processingWithdrawal`, `approveWithdrawal`, `rejectWithdrawal` |
| `src/infra/db/repositories/donations.repositories.ts` | `processDonation`: transição idempotente `pending → paid` (count 0 → throw) + `creditDonation` na mesma transação |
| `src/modules/withdrawals/withdrawals.service.ts` | Gate de valor mínimo, math de taxa/net, idempotência `clientKey`, posse da chave Pix, `handleWebhookPixSend` (reconstrução de UUID + transições SUCCESS/FAILED) |
| `src/modules/webhooks/webhooks.controller.ts` | HMAC timing-safe contra `EFI_WEBHOOK_SECRET`, cap de batch 5, roteamento `gnExtras.idEnvio` (saque) vs `txid` (doação) |
| `src/modules/auth/auth.service.ts` | `login2fa` (nonce ligado a userId, consumo único), `verifyOtp` (cap de 5 tentativas), `createSession`/`logout`/`logoutAll` (sid + listas redis + JWT `sub/sid/roles`), tokens de reset |
| `src/modules/account-settings/account-settings.service.ts` | setup/enable/disable 2FA (segredo staged cifrado no redis, TTL 600s), re-checagem de senha, variantes de kill de sessões (all vs except-current) |
| `src/common/security/security.service.ts` | AES-256-GCM round-trip (iv+tag+ct), detecção de tamper, `hashData` determinístico |
| `src/modules/auth/auth.guard.ts` | JWT válido **e** sessão viva no redis, bypass `@Public` |

### P1 — núcleo de produto

| Alvo | O que tem de lógica real |
|---|---|
| `src/modules/widgets/overlay.service.ts` (402 LOC, maior do repo) | Máquina de estados da fila: claim atômico via `RedisService.setIfNotExists` (SET NX EX 300) com requeue na falha, pausa, ids sintéticos `test-`, descarte de doações deletadas (anti-ghost), `alertFinished` real-vs-test, `syncDashboardQueue` (filtro de test ids, purga de stale, prepend do current), heartbeat 80s |
| `src/infra/queues/donations/donations-queue.processor.ts` | Pipeline do worker: rejeita já-paga, `verifyPaymentStatus` (PAID + igualdade `Decimal` do valor pago), prefixo `"{name} mandou R$X: "` no TTS, upload R2 `tts/{username}-{id}.wav`, ordem processDonation → emit → overlay |
| `src/modules/donations/donations.service.ts` | Gates `Decimal` de `minTextAmount`/`minAudioAmount`, `maxLength`, voz ativa, webhook idempotente (só enfileira `pending`) |

### P2 — quick wins e lógica pura (custo ~zero, mocking mínimo)

- `src/common/utils/mask.util.ts` — `maskPixKey` (cpf/cnpj/phone/email/random + fallbacks) — **melhor primeiro teste**, zero deps.
- `src/infra/redis/redis-keys.ts` — builders + constantes de TTL.
- Entities/mappers: `DonationHistoryEntity.fromDonation` (conversão `Decimal`→Number), `OverlayDonationEntity.toResponse` (filtro XSS), `SafeUser.fromPrisma`, `WithdrawalsService.mapToEntity`.
- `src/common/guards/roles.guard.ts` — puro com request/reflector mockados.
- `src/modules/profile/profile.service.ts` — blacklist (permanente vs expirante) + cooldown de 15 dias de username.
- `src/modules/pix-keys/pix-keys.service.ts` — `detectKeyType` (privado em `pix-keys.service.ts:96`; extrair para util facilita).
- `src/infra/gateway/Efi/efi.service.ts` — mappers de status (`getPixStatus`, `mapEfiSentPixStatus`); extrair os mappers para testar sem mockar HttpService.
- `src/common/config/env.validation.ts` — schema class-validator (153 LOC).
- Schedulers (`wallets-scheduler`, `withdrawals-scheduler`) — lógica de loop com repos mockados.

**Onde NÃO gastar tempo:** CRUDs finos (`voices`, `donation-settings`, `health`) e o `dashboard.service` (a lógica pesada é SQL agregado no repository — território de teste de integração, não unit).

## Roadmap em fases

Decisões registradas nesta avaliação: camada de dinheiro com **unit + mocks primeiro**, integração com banco real depois; nada de código nesta rodada.

### Fase 0 — Setup (~meio dia, bloqueia todo o resto)

1. `moduleNameMapper` `^src/(.*)$` → `<rootDir>/$1` no bloco `jest` do `package.json`.
2. Alinhar ts-jest ↔ Jest 30 e confirmar com o primeiro run.
3. `clearMocks: true` + `setupFiles` com env dummies (`ENCRYPTION_KEY`, `BUCKET_URL`, `REDIS_URL`).
4. Remover/regra `test/app.e2e-spec.ts` (scaffold morto).
5. Atualizar a linha "Verificação" do `AGENTS.md` para incluir `pnpm test`.

### Fase 1 — P0 unit com mocks (~8-12 specs)

Ordem sugerida (primeiro item valida o setup inteiro):

1. `mask.util.spec.ts` — puro, valida que a tooling funciona.
2. `security.service.spec.ts` — round-trip AES, tamper detection, hash.
3. `withdrawals.service.spec.ts` — taxa/net, mínimo, `clientKey`, posse Pix, webhook.
4. `wallets.repositories.spec.ts` — `applyOp` mockado: deriva de `balanceAfter` do ledger (não do cache), rejeita negativo, math de `pendingBalance`; `reconcile` com cadeia válida/quebrada.
5. `donations.repositories.spec.ts` — idempotência do `processDonation`.
6. `withdrawals.repositories.spec.ts` — transições guardadas (sucesso e recusa por status errado).
7. `auth.service.spec.ts` — 2FA login/nonce, cap de OTP, sessões (mockar bcryptjs/otplib).
8. `account-settings.service.spec.ts` — gates de 2FA e kill de sessões.
9. `overlay.service.spec.ts` — máquina de estados da fila (mockar `RedisService`).
10. `donations-queue.processor.spec.ts` — mismatch de valor, já-pago, prefixo TTS, ordem do pipeline.
11. `donations.service.spec.ts` — gates Decimal, webhook idempotente.
12. `webhooks.controller.spec.ts` — HMAC válido/inválido, cap 5, roteamento.

> Limites conhecidos do mock: os testes de `applyOp` com mocks pinam a **lógica de decisão**, mas não cobrem `FOR UPDATE`, atomicidade real nem o trigger de saldo do commit `e7da997` — é exatamente o que a Fase 2 cobre.

### Fase 2 — Integração da camada de dinheiro (Postgres de teste via docker)

- Subir Postgres efêmero (docker já é padrão no repo via `docker-compose.yml`), rodar `migrate deploy`, truncar entre testes.
- Specs de integração para os 3 repositories de dinheiro: atomicidade das `$transaction`, comportamento do trigger de saldo, `updateMany` guardado sob status real, cadeia do ledger com escritas concorrentes simuladas.
- Validação do job `reconcile` contra dados reais (hoje ele é detect-only: loga drift, não repara).

### Fase 3 — P1/P2 restantes + CI

- Specs P2 (quick wins) e P1 restantes; extrações pequenas que facilitam (`detectKeyType`, mappers do Efí → utils puros).
- Plug do `pnpm test` no pipeline proposto em `docs/plans/2026-09-02-ci-cd-pipeline.md` (job `quality` já reserva o slot).

## Observações que os testes também ajudariam a expor

- `reconcile` detecta drift mas não repara (decisão atual, só registrando).
- A moderação Gemini no processor está comentada (`donations-queue.processor.ts:48-51`) — o TTS lê a mensagem bruta do doador.
- O HMAC do webhook Efí é segredo compartilhado comparado via query param, não assinatura de payload.
