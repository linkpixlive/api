# Sugestões de funcionalidades — LinkPix API

> Sugestões levantadas por leitura do código em 2026-09-25. Cada item aponta onde tocaria (`módulo`/arquivo) e o tamanho aproximado: **S** (< 0,5 dia) · **M** (0,5–2 dias) · **L** (> 2 dias).
>
> **Já fora do escopo** — existem 4 planos abertos que cobrem esse terreno; não repetir aqui: MED + `TransactionType.fee` + `blockedBalance` (`plans/2026-08-12-med-and-fee-ledger.md`), limite de saque R$300/30d (`plans/2026-09-02-withdrawal-limits.md`), cache de usuário no `AuthGuard` (`plans/2026-09-02-auth-guard-user-cache.md`), CI/CD (`plans/2026-09-02-ci-cd-pipeline.md`).

## Como ler

- **Agora** — barato, fecha lacuna que já dói (falta de endpoint, e-mail que não existe).
- **Próximo** — valor de produto claro, mas exige schema ou decisão.
- **Depois** — só quando houver demanda real; o custo é de contrato externo, não de código.

---

## Agora

### 1. Extrato do ledger (streamer + admin) — S

Hoje não existe **nenhum** endpoint de extrato: o saldo vem de `Wallets.currentBalance`, que é cache derivado de `transactions` (append-only). Streamer não consegue ver para onde o dinheiro foi, e admin não consegue auditar sem acesso ao banco.

- `GET /wallets/transactions` — paginado, filtro por `type` e período, `Decimal → Number` via `@Transform` (mesmo padrão de `WalletBalancesEntity`).
- `WalletsRepository` já tem `findMany`; falta o método de leitura do ledger por usuário.
- É a base de qualquer "extrato" ou "contador" depois — item 2 vira uma linha a mais.

### 2. Export CSV (histórico e saques) — S

`GET /donations/history` e `GET /withdrawals` já são paginados e filtráveis. Um `?format=csv` (ou rota `/history.csv`) reaproveita a mesma query e devolve stream de texto. Valor: suporte, contador, planilha do streamer. Sem schema, sem índice novo.

### 3. E-mail de saque pago — S

Só existem 2 templates: `verify-email.hbs` e `forgot-password.hbs`. O ciclo de saque (`pending → processing → success | failed`) não avisa ninguém por e-mail — o streamer só descobre olhando o dashboard. Adicionar `withdrawal-settled.hbs` disparado no `approveWithdrawal`/`failProcessingWithdrawal` (via `EmailService`, que já é fila). Custa um template + uma chamada em dois caminhos existentes.

### 4. Reativação de conta — S/M

`PATCH /account/deactivate` é uma porta de mão única: não existe reativação nem por API nem por job. O plano original (`specs/2026-08-04-account-settings-design.md`) prometeu auto-reativação e ela não está no código. Duas saídas possíveis:

- **barata**: um job no `AuthCleanupService` (que já roda a cada 30 min) reativa contas inativas há N dias e manda e-mail com link. Cuidado: enquanto inativo, não deve mover saldo nem aceitar pedido de saque — precisa checar `active` onde hoje só se checa `verified`.
- **manual**: `POST /account/reactivate` com OTP. Mais previsível, mais código.

Recomendo a reativação por e-mail (o `EmailService` e o padrão de OTP já existem).

### 5. Top doadores — S

Agregação `groupBy` em `Donation` por nome doador + `sum(amount)`, janela de 7/30 dias. Hoje `GET /dashboard/stats` devolve um blob agregado e nada mais. Habilita ranking no overlay e no dashboard, que é o principal gancho de engajamento em live. Requer índice em `donation.user_id` + `amount` se ainda não existir (checar com `docs/data.md`).

### 6. Doação anônima — S

Um booleano `anonymous` em `Donation` (+ campo em `DonationDto`). Overlay e histórico exibem "Anônimo". Comum em mercado BR, onde a mensagem escrita pelo doador é frequentemente bloqueada pelo filtro. Cuidado com o ranking: um doador anônimo não pode virar doador identificável no item 5 — decidir a regra antes.

---

## Próximo

### 7. Meta de donate (donation goal) — M

`DonationGoal` 1:1 com `User`: `title`, `targetAmount`, `endsAt?`. Leitura pelo mesmo endpoint público que já serve dados do doador (`GET /donations/user/:username`), para o overlay não precisar de chamada nova. Barra renderiza a partir de `widgets.settings` (Json). Alta frequência de uso em live BR; sem isso o overlay só mostra valor por alerta.

### 8. Registro de moderação IA (fecho do `aiModeration`) — M

O filtro já bloqueia antes do QR Code (`plans/2026-09-15-ai-moderation-filters.md`, feito), mas a decisão não é persistida em lugar nenhum: o doador bloqueado volta 5 minutos depois e tenta de novo, e o streamer não tem como revisar nem banir.

- `AiModerationLog` (`donationId?`, `donorNameHash`, `blocked`, `categories`, `message`, `createdAt`) — escrita no ponto único hoje chamada (`GeminiService.moderate()`).
- `GET /donation-settings/blocked-messages` paginado + ação de banir doador (hash do nome/e-mail, com TTL — reusar `RedisService` + builder em `redis-keys.ts`).
- É o item 2 do backlog deixado explicitamente pelo plan de moderação; não é novidade, é dívida registrada.

### 9. Presets de overlay — S

`Widget.settings` é `Json` livre, e cada streamer monta do zero: fonte, posição, duração, imagem. Guardar N presets em `Widget` (`settings_presets Json` + `activePreset String`) com `GET/PUT /widgets/:type/presets/:name` resolve em uma tarde e é a maior redução de atrito no onboarding. Zero mudança de contrato: o overlay continua lendo `settings`.

### 10. Admin: listagens e gestão de username blacklist — M

Os repositórios existem (`UsersRepository`, `WithdrawalsRepository`, `DonationsRepository`, `UsernameBlacklistRepository` — este último com create/delete/find e **nenhum** controller), mas o admin só tem 3 endpoints: aprovar/rejeitar saque, verificar usuário. Faltam as telas de operação:

- `GET /admin/users` (filtro por `active`/`verified`/busca), `GET /admin/withdrawals`, `GET /admin/donations`.
- `POST/DELETE /admin/username-blacklist` — hoje só existe caminho interno.
- "Ban permanente" e reativação manual de conta, que item 4 deixa sem lugar na UI admin.

### 11. Limite por doador (anti-abuso) — M

O throttler protege a API, não o valor. Barba de 5 doações de R$ 500 do mesmo nome/IP em 1h passa. A regra cabe numa consulta agregada antes de `generatePix` — o valor ainda não foi movimentado, que é o melhor lugar possível. Reusa o `Donation.ip` que já é persistido.

---

## Depois

### 12. Assinatura / Pix recorrente — L

O item que streamers mais pedem e o mais caro: exige contrato novo na EFÍ (recorrência/renovação), cycle próprio, idempotência de cobrança (`Transaction.donationId` é `unique`, então o modelo atual não comporta mais de uma cobrança por item) e política de cancelamento/estorno. Não é um endpoint — é um módulo. Só quando dois ou três streamers pagarem para isso.

### 13. Relatório financeiro para contador — M (depende de 12)

DRE, informe de retenção, conciliação com o extrato do Pix. Depende do extrato (item 1) e, para recorrência, do item 12. Derivar do ledger, nunca de `Wallet` (o cache pode divergir até a reconciliação das 3h).

### 14. Observabilidade — M

Winston local está instalado e não há tracing nem erro centralizado. Uma doação que falha 4x no `donations-queue` e vira `expired` silenciosamente é exatamente o que o time de ops precisa ver. Começar por Sentry no `GlobalExceptionFilter` + métricas da fila (profundidade, taxa de falha, idade do job mais velho).

---

## Dívida transversal (1 linha cada, não são features)

- **Eventos WS inconsistentes**: `overlay` usa snake_case (`new_donation`, `alert_finished`), `dashboard` usa `donation:created`. Escolher um e migrar — cliente OBS já depende do nome atual.
- **`blockedBalance` nunca é escrito** e **`TransactionType.withdrawal` está declarado e não usado** — campo/enum morto que promete um comportamento que não existe. Ou implementa com o plan MED, ou remove.
- **`GET /health` é só liveness** — sem readiness nem checagem de Postgres/Redis, o orquestrador não sabe quando pode mandar tráfego.
- **Sem suíte de testes** (jest configurado no `package.json`, zero `*.spec.ts`). Já avaliado em `audits/2026-09-02-unit-tests-assessment.md`; o mais barato é cobrir `applyOp` (ledger + trigger) e o processor de doações.
- **`AiContract.moderate()` sem endpoint de teste**: o streamer ativa `aiModeration` às cegas, sem como validar as `customRules` antes de receber a próxima doação. Backlog item 3 do plan de moderação, ~1 hora.

## Descartado de propósito (YAGNI)

Multi-câmbio, split de pagamento, chat/overlay social, pontos de fidelidade, referral, plugin system, GraphQL, i18n do e-mail, motor de templates de overlay pelo backend, integração com Telegram/Discord. Nenhum resolve uma dor que o código já mostre; todos custam schema e suporte.
