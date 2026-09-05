# Plano: limite de saque por conta (R$ 300 default) com solicitação e aprovação admin

**Data:** 2026-09-02
**Status:** aprovado (não implementado)
**Área:** `src/modules/withdrawals`, `src/modules/admin`, `src/infra/db/repositories`, `prisma`

## Problema

Hoje qualquer usuário autenticado pode sacar todo o saldo disponível via `POST /withdrawals` — a única validação de valor é o mínimo (`MIN_WITHDRAWAL_AMOUNT`, `withdrawals.service.ts:45-52`). Não existe conceito de limite por conta, teto de período nem fluxo de solicitação de aumento. O objetivo é conter exposição financeira: toda conta nasce com limite de **R$ 300**, pode **solicitar aumento** e o **admin aprova/reprova manualmente** (sem critério automático por enquanto).

## Regras de negócio (decisões confirmadas)

1. **Semântica do limite — janela móvel de 30 dias.** A soma de `grossAmount` dos saques com status `pending | processing | success` criados nos últimos 30 dias não pode ultrapassar `users.withdrawal_limit`. Saques `failed` não consomem limite (o valor é reembolsado ao saldo pelo `refundWithdrawal`). Escolhida em vez de "por saque" (contornável parcelando) e "vitalício" (travaria todo usuário ativo, explodindo o trabalho manual do admin).
2. **Default R$ 300** para todas as contas, via default da coluna — cobre contas existentes e novas sem backfill.
3. **Solicitação de aumento:** o usuário envia o valor desejado; deve ser **maior que o limite atual**. **Cooldown de 10 dias contados da última solicitação**, independentemente do resultado (pendente, aprovada ou rejeitada) — consequência: no máximo 1 solicitação pendente por vez.
4. **Aprovação admin com valor ajustável:** o endpoint de aprovação aceita `approvedAmount` opcional; se omitido, aplica exatamente o valor solicitado. Rejeição não altera o limite. O valor ajustável evita obrigar o usuário a esperar os 10 dias para re-solicitar outro valor.
5. **Verificação:** regra não usa Redis; autoritativa dentro da transação de criação do saque (ver item 5).

## Mudanças

### 1. Schema + migration (`prisma/schema.prisma`)

- `User`: `withdrawalLimit Decimal @default(300) @map("withdrawal_limit") @db.Decimal(12, 2)`.
- Novo enum `WithdrawalLimitRequestStatus { pending approved rejected }`.
- Novo model `WithdrawalLimitRequest` (`@@map("withdrawal_limit_requests")`):
  - `id`, `userId`, `requestedAmount Decimal(12,2)`, `status @default(pending)`, `reviewedById String? @db.VarChar(36)`, `reviewedAt DateTime?`, `createdAt`, `updatedAt`;
  - relação `user` (`onDelete: Cascade`);
  - `@@index([userId, createdAt])` (lookup de cooldown) e `@@index([status, createdAt])` (listagem admin).
- `Withdrawal`: adicionar `@@index([userId, status, createdAt])` para a agregação da janela.
- Migration `pnpm db:migrate` → `ALTER TABLE users ADD COLUMN withdrawal_limit DECIMAL(12,2) NOT NULL DEFAULT 300`, create table + índices. Subir o Postgres via `docker-compose` se necessário.
- Sem novas env vars: default 300 é default da coluna; cooldown (10 dias) e janela (30 dias) são constantes no service — precedente do cooldown de username (`profile.service.ts`, 15 dias hardcoded).

### 2. Repositories (`src/infra/db/repositories/`)

- **Novo `withdrawal-limit-requests.repositories.ts`** (`WithdrawalLimitRequestsRepository`):
  - `createRequest({ userId, requestedAmount, cooldownDays })` — `$transaction`: `SELECT id FROM users WHERE id = ... FOR UPDATE` (serializa por usuário, mesmo padrão do `applyOp` em `wallets.repositories.ts:99-101`), busca a última solicitação; se `createdAt > now - cooldownDays` → `BadRequestException` com dias restantes; senão cria com `status: pending`. A checagem sob lock torna o cooldown race-safe.
  - `findLatestByUserId(userId)` — para a pré-checagem amigável e o snapshot no `GET /withdrawals/limit`.
  - `findById(id)` — 404 se ausente (padrão de `WithdrawalsRepository.findById`).
  - `findMany({ status?, page, limit })` — paginado, `createdAt desc`, `include user { name, email, username, verified }` (será a primeira listagem do painel admin).
  - `decide({ id, decision: 'approved' | 'rejected', reviewedById, approvedAmount? })` — `$transaction`: `updateMany` com guarda `where: { id, status: pending }` (padrão de `approveWithdrawal`, `withdrawals.repositories.ts:131-144`; `count === 0` → 400 "não está pendente"), grava `reviewedById/reviewedAt`; se `approved`, atualiza `user.withdrawalLimit = approvedAmount` na mesma tx.
  - Params tipados como interfaces TS em `dto/` (convenção da pasta), não class-validator.
- **`withdrawals.repositories.ts`**:
  - Novo `sumConsumedSince(userId, since?: Date)` — `aggregate({ _sum: { grossAmount } })` com `status in [pending, processing, success]` e `createdAt >= since` quando informado.
  - `processWithdrawal`: novos params `limit: Decimal` e `windowStart: Date | null`; **dentro da tx, após `reserveForWithdrawal`** — que já locka a wallet e serializa saques do mesmo usuário —, re-agrega o consumido (variante com `tx`) e, se exceder `limit`, lança 400 → rollback atômico (mesma natureza do "Saldo insuficiente" no `applyOp`, `wallets.repositories.ts:120-122`).
- **`users.repositories.ts`**: reutilizar `findById`/`update` existentes.

### 3. Lado do usuário (módulo `withdrawals`)

- **DTO** `dto/create-withdrawal-limit-request.dto.ts`: `requestedAmount` com `@IsNumber({ maxDecimalPlaces: 2 }) @IsPositive @Max(999999.99)` + `@ApiProperty`, mensagens PT-BR (padrão de `create-withdrawal.dto.ts`).
- **Entities** (padrão `@Exclude`/`@Expose` + `@Transform(Number)` para decimais, como `wallet-balances.entity.ts`):
  - `entities/withdrawal-limit.entity.ts`: `limit`, `usedInWindow`, `remaining` (nunca negativo), `windowDays`, `pendingRequest? { id, requestedAmount, createdAt }`, `nextRequestAvailableAt?` (última solicitação + 10 dias, quando ainda em cooldown).
  - `entities/withdrawal-limit-request.entity.ts`: `id`, `userId`, `requestedAmount`, `status`, `createdAt`, `reviewedAt`, `user?` (resumo p/ admin).
- **Service** `withdrawal-limits.service.ts` (`WithdrawalLimitsService`), constantes `COOLDOWN_DAYS = 10` e `WINDOW_DAYS = 30`:
  - `getLimit(user)` — limite de `usersRepository.findById` + `sumConsumedSince(now - 30d)` + última solicitação → `WithdrawalLimitEntity`.
  - `requestIncrease(user, dto)` — pré-checagem amigável (cooldown via `findLatestByUserId`, cálculo de dias restantes igual ao de `profile.service.ts:54-65`; `requestedAmount` deve ser `>` limite atual) e depois `createRequest` (checagem autoritativa sob lock).
- **Controller** `withdrawal-limits.controller.ts` (`@Controller('withdrawals')`):
  - `GET /withdrawals/limit` → `WithdrawalLimitEntity` (não colide: não existe rota `GET /withdrawals/:id`).
  - `POST /withdrawals/limit-requests` → cria solicitação.
- Wiring no `withdrawals.module.ts` (controller + service).

### 4. Lado do admin (módulo `admin`)

- **DTOs** em `src/modules/admin/dto/`: `ListWithdrawalLimitRequestsQueryDto` (`status?` enum + paginação) e `ApproveWithdrawalLimitRequestDto` (`approvedAmount?` opcional, mesmas regras numéricas do DTO de solicitação).
- **Service** `services/admin-withdrawal-limits.service.ts`:
  - `list(query)` — delega ao repository, mapeia para entity;
  - `approve(id, dto, adminId)` — `approvedAmount = dto?.approvedAmount ?? request.requestedAmount`; valida `> 0` e `> limite atual` do usuário; delega a `decide`;
  - `reject(id, adminId)` — delega a `decide`.
- **`controllers/admin.controller.ts`** (`@Roles(UserRole.admin)` já na classe; `@CurrentUser()` fornece o `adminId`):
  - `GET /admin/withdrawal-limit-requests` — listagem (filtro `status=pending` para a fila de aprovação);
  - `PATCH /admin/withdrawal-limit-requests/:id/approve`;
  - `PATCH /admin/withdrawal-limit-requests/:id/reject`.
- Wiring no `admin.module.ts`.

### 5. Gate na criação de saque

`WithdrawalsService.create` (`withdrawals.service.ts:29-86`), após as validações existentes (mínimo, carteira, chave pix):

1. limite do usuário (`usersRepository.findById`) e consumido (`sumConsumedSince(now - 30d)`);
2. pré-checagem rápida: se `amount + consumed > limit` → `BadRequestException("Limite de saque excedido. Limite: R$ X · utilizado nos últimos 30 dias: R$ Y · disponível: R$ Z.")`;
3. a checagem **autoritativa** roda dentro da tx do `processWithdrawal` (item 2), imune a corridas graças ao lock da wallet — dois saques concorrentes não podem somar além do limite.

### 6. Documentação

- `docs/data.md`: novo model `withdrawal_limit_requests`, coluna `users.withdrawal_limit`, índice novo em `withdrawals` e a invariante (limite verificado por agregação de saques da janela, não por saldo; consumido = `pending + processing + success`).
- `docs/security.md`: nota curta do limite como controle antifraude de saque.

## Fora de escopo

- **Bug P2002 do ledger (decisão: manter fora):** `Transaction.withdrawalId` é `@unique` (`schema.prisma:236`), mas `reserveForWithdrawal` + `confirmWithdrawal`/`refundWithdrawal` gravam duas linhas de ledger com o mesmo `withdrawalId` → todo approve/reject de saque falha com P2002 e os fundos ficam presos em `pendingBalance`. Documentado em `docs/audits/wallet-vulnerabilities.md` #1. A criação de saques (onde o limite atua) não é afetada; a conclusão do ciclo já estava quebrada antes desta feature. Sugerir issue separada (caminho provável: remover o `@unique`).
- Notificações (email/websocket) de aprovação/rejeição — hoje nenhuma decisão admin notifica; extensão futura dos templates do `email-queue`.
- Critérios automáticos de aprovação de limites.

## Sequência de implementação

1. Schema + migration (`pnpm db:migrate`).
2. Repositories (`withdrawal-limit-requests.repositories.ts`; ajustes em `withdrawals.repositories.ts`).
3. Lado do usuário (DTO, entities, service, controller, module).
4. Lado do admin (DTOs, service, endpoints, module).
5. Gate no `WithdrawalsService.create`.
6. Docs (`data.md`, `security.md`).
7. Verificação: `pnpm build` + `pnpm lint` (não há suíte de testes).
