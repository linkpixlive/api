# Avaliação de Segurança — Módulo Wallet

> Escopo: `src/modules/wallets/*`, `src/infra/db/repositories/wallets.repositories.ts`, `src/infra/db/repositories/dto/wallets.dto.ts`, `prisma/schema.prisma` (models `Wallet`/`Transaction`).  
> Data: 2026-09-02

## Ranking por Gravidade

| # | Severidade | Vulnerabilidade |
|---|------------|-----------------|
| 1 | 🔴 CRÍTICA | Ciclo de saque quebrado por `withdrawalId` duplicado no ledger (fundos travados) |
| 2 | 🟠 ALTA | Reconciliação com ordenação não determinística |
| 3 | 🟡 MÉDIA | Cron sem lock distribuído + carregamento sem paginação |
| 4 | 🟡 MÉDIA | Repository lançando `HttpException` |
| 5 | 🟢 BAIXA | `lastTransactionId` sem FK |
| 6 | 🟢 BAIXA | `GET /wallets/balances` sem `@Throttle` explícito |
| 7 | 🟢 BAIXA | Índice composto ausente para reconciliação |
| 8 | ⚪ INFO | Logs do scheduler expõem saldos |

---

### 1. 🔴 CRÍTICA — Ciclo de saque quebrado por `withdrawalId` duplicado (funds lock-up)
- **Arquivos:** `src/infra/db/repositories/wallets.repositories.ts:57,72,87` + `prisma/schema.prisma:236` + `src/infra/db/repositories/withdrawals.repositories.ts:150,194`
- `Transaction.withdrawalId` é `@unique`, mas `reserveForWithdrawal` grava uma linha com `withdrawalId = withdrawal.id` e `confirmWithdrawal`/`refundWithdrawal` tentam gravar segunda linha com o mesmo id → violação `P2002` em todo `approve`/`reject` e rollback da transação, deixando saques presos em `pending/processing` e saldo congelado em `pendingBalance`.

### 2. 🟠 ALTA — Reconciliação com ordenação não determinística
- **Arquivo:** `src/infra/db/repositories/wallets.repositories.ts:167,178`
- `orderBy: { createdAt: 'asc' }` apenas; empates de timestamp reordenam entradas e tornam `chainValid` não confiável.

### 3. 🟡 MÉDIA — Cron sem lock distribuído + carregamento sem paginação
- **Arquivos:** `src/modules/wallets/wallets-scheduler.service.ts:11` + `src/infra/db/repositories/wallets.repositories.ts:165-168`
- `@Cron(EVERY_DAY_AT_3AM)` roda em cada réplica sem lock distribuído e `reconcile()` faz `findMany` sem paginação de todas as transações do usuário.

### 4. 🟡 MÉDIA — Repository lançando `HttpException`
- **Arquivo:** `src/infra/db/repositories/wallets.repositories.ts:108,121,162`
- `NotFoundException`/`BadRequestException` lançadas dentro de `infra/db`, violando `RULES.md §1.1` (camada de repositório não deve lançar exceções HTTP).

### 5. 🟢 BAIXA — `lastTransactionId` sem FK
- **Arquivo:** `prisma/schema.prisma:126`
- `Wallet.lastTransactionId` é `VarChar(36)` sem relação/FK; ponteiro órfão zera silenciosamente a derivação de saldo.

### 6. 🟢 BAIXA — `GET /wallets/balances` sem `@Throttle` explícito
- **Arquivo:** `src/modules/wallets/wallets.controller.ts:19`
- Coberto apenas pelos throttlers globais (`app.module.ts`); sem decorador explícito no endpoint autenticado.

### 7. 🟢 BAIXA — Índice composto ausente para reconciliação
- **Arquivo:** `prisma/schema.prisma:242-244`
- Reconciliação filtra por `userId` e ordena por `createdAt`; existem apenas índices isolados.

### 8. ⚪ INFO — Logs do scheduler expõem saldos
- **Arquivo:** `src/modules/wallets/wallets-scheduler.service.ts:34-38`
- Detalhes de `walletBalance`/`ledgerBalance` por `userId` são escritos em log em texto plano.
