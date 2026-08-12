# Ledger-Authoritative Balance — Implementation Plan

**Stored-mutable `currentBalance` → ledger-derived balance projection with per-user lock + reconciliation**

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the dual-source-of-truth between `Wallet.currentBalance` (stored mutable cache) and the `Transaction` ledger. Make the ledger self-deriving — every `balanceAfter` computed from the previous ledger entry, never from the wallet row — and add a per-user row lock plus a nightly reconciliation job.

**Architecture:** Clean Architecture preserved — all Prisma calls stay in `src/infra/db/repositories/`, financial mutations remain inside `prisma.$transaction()`, errors are `HttpException` subclasses, and the global `GlobalExceptionFilter`/`ResponseInterceptor` envelope is untouched.

**Context & conversation summary:** `currentBalance` is a stored, mutable snapshot written in three places (`DonationsRepository.processDonation`, `WithdrawalsRepository.processWithdrawal`, `rejectWithdrawal`). Because it is independent of the append-only ledger, it can silently drift (bug, partial deploy, direct DB write) and neither code nor data can explain the discrepancy. Worse, every `balanceAfter` is currently copied *from* `wallet.currentBalance` inside the same transaction, so a stale wallet poisons the entire audit trail. The fix — the industry-standard fintech pattern — is: **ledger is the source of truth (`balanceAfter` derived from the previous ledger row), wallet column is a projection/cache, reconciliation proves they agree.**

---

## What was already fixed (prior work — out of scope)

The following were addressed in commits `1445c09` / `5fc3de0` / `e3bfd4d` and are **not** part of this plan:

- Missing `withdraw_reserve` ledger entry (M8) — now written by `processWithdrawal`.
- Unbounded `findProcessingWithdrawals` (M4) — now bounded with `take` + `orderBy createdAt asc`.
- `rejectWithdrawal` not persisting `transactionId` (M2) — now persisted on withdrawal and ledger.
- Admin double-pay race on `approve()` (Task 4 / 2026-08-05-financial-security-hardening) — atomic pending→processing transition before gateway call, rollback on failure.
- Blind webhook mutation (Task 3) — `handleWebhookPixSend` validates existence, mutable state, and `transactionId` consistency before mutating.
- Donor underpaying (M7) — donations queue processor compares Efi `paidAmount` to `donation.amount`.
- `WalletsRepository` created — currently read-only (`findByUserId`).

---

## Root cause

`balanceAfter` is derived **from** `wallet.currentBalance`. The ledger is a *mirror* of the wallet, not a *source*. To fix this, invert the dependency: the ledger **self-derives** — each entry's `balanceAfter = previousEntry.balanceAfter + signedDelta`. The wallet becomes a **cache written from the computed value**, never an input to it.

## Design goal

| Property | Target |
|---|---|
| **Single source of truth** | `transactions` table (append-only, immutable) |
| **Fast read** | `Wallet.currentBalance` as a cache — derived, never trusted blindly |
| **Concurrency correctness** | Per-user row lock (`SELECT … FOR UPDATE`) serializes all financial writes; the `currentBalance >= amount` conditional update remains as a defensive backstop |
| **Auditability** | Every mutation has a ledger entry; every `balanceAfter` is derivable from the chain; reconciliation verifies |
| **Drift detection** | Nightly cron job asserts `wallet.currentBalance == balanceAfter(lastTransactionId)` |

---

## Global Constraints

- All Prisma calls stay in `src/infra/db/repositories/` — no exceptions
- Financial mutations must use `prisma.$transaction()`
- Errors must be thrown as `BadRequestException`/`NotFoundException`/`UnauthorizedException` — no custom filters
- No `process.env` outside bootstrap — use `ConfigService`
- Redis keys must have TTL (if any new ones are created)
- New env vars go in `EnvironmentVariables`
- No git commits unless explicitly requested
- The project currently has **zero `*.spec.ts` files** — no test suite exists. Verification = `pnpm build` passes. Runtime end-to-end verification is the user's responsibility.
- **No Prisma migration required** — all work uses existing columns/enums (`withdraw_reserve`, `refund`, `withdraw_confirm`, `donation` types already exist; `lastTransactionId` and `balanceAfter` already exist).

---

## File Structure

| File | Change Type | Responsibility |
|---|---|---|
| `src/infra/db/repositories/dto/wallets.dto.ts` | Modify | Add `FinancialOperationParams`, `FinancialOperationResult` |
| `src/infra/db/repositories/wallets.repositories.ts` | Expand | 4 financial ops + row-lock + self-deriving ledger append; `reconcile` |
| `src/infra/db/repositories/donations.repositories.ts` | Modify | Remove inline wallet/ledger writes; call `walletsRepository.creditDonation(tx, …)` |
| `src/modules/donations/queues/donations-queue.processor.ts` (or `src/infra/queues/donations/donations-queue.processor.ts`) | Modify | Pass `ip` into `ProcessDonationParams` so the ledger entry records it |
| `src/infra/db/repositories/withdrawals.repositories.ts` | Modify | Remove inline wallet/ledger writes; call `reserveForWithdrawal`, `confirmWithdrawal`, `refundWithdrawal` |
| `src/infra/db/repositories/dto/withdrawals.dto.ts` | Modify | Remove `grossAmount` from `CreateWithdrawalParams` (computed inside the op) |
| `src/modules/withdrawals/withdrawals.service.ts` | Review only | No change expected — it already delegates to repository methods |
| `src/modules/wallets/wallets-scheduler.service.ts` | Create | Nightly reconciliation cron job |
| `src/modules/wallets/wallets.module.ts` | Modify | Register reconciliation scheduler |
| `docs/superpowers/plans/2026-08-10-ledger-derive-balance.md` | Create | This plan |

---

## Task 1: Wallet repository — financial ops with row-lock + self-deriving ledger

**Files:**
- Modify: `src/infra/db/repositories/dto/wallets.dto.ts`
- Expand: `src/infra/db/repositories/wallets.repositories.ts`

**Interfaces:**

```typescript
// dto/wallets.dto.ts
export interface FinancialOperationParams {
  userId: string;
  amount: Decimal;          // signed: positive for credits, negative for debits
  type: TransactionType;
  transactionId: string;    // external reference (donation txn id, withdrawal id)
  donationId?: string;
  withdrawalId?: string;
  ip?: string;
}

export interface FinancialOperationResult {
  wallet: Wallet;
  transaction: Transaction;
}
```

**Method signatures on `WalletsRepository`:**

```typescript
async lockWallet(tx: Prisma.TransactionClient, userId: string): Promise<Wallet>;
async creditDonation(tx, params: FinancialOperationParams): Promise<FinancialOperationResult>;
async reserveForWithdrawal(tx, params: FinancialOperationParams): Promise<FinancialOperationResult>;
async confirmWithdrawal(tx, params: FinancialOperationParams): Promise<FinancialOperationResult>;
async refundWithdrawal(tx, params: FinancialOperationParams): Promise<FinancialOperationResult>;
async reconcile(userId: string): Promise<{ wallet: Wallet; ledgerBalance: Decimal; match: boolean }>;
```

**Core private pattern (`applyFinancialOp`):**

```typescript
private async applyFinancialOp(
  tx: Prisma.TransactionClient,
  params: FinancialOperationParams,
): Promise<FinancialOperationResult> {
  // 1. Lock per-user row — serializes all financial writes for this user
  const walletRows = await tx.$queryRaw<Wallet[]>`
    SELECT id, user_id, current_balance, pending_balance, blocked_balance, last_transaction_id
    FROM wallets WHERE user_id = ${params.userId} FOR UPDATE
  `;
  if (!walletRows.length) throw new NotFoundException('Wallet not found.');

  const wallet = walletRows[0];

  // 2. Read previous ledger entry (via lastTransactionId pointer) and compute new balance
  const prevTx = wallet.lastTransactionId
    ? await tx.transaction.findUnique({ where: { id: wallet.lastTransactionId } })
    : null;

  const prevBalance = prevTx ? prevTx.balanceAfter : new Decimal(0);
  const newBalance = prevBalance.plus(params.amount);

  // 3. Insufficient-funds guard (debits only)
  if (params.amount.isNegative() && wallet.currentBalance.lessThan(params.amount.abs())) {
    throw new BadRequestException('Insufficient available balance.');
  }

  // 4. Append ledger entry (self-derived — not copied from wallet)
  const txRow = await tx.transaction.create({
    data: {
      userId: params.userId,
      amount: params.amount,
      type: params.type,
      transactionId: params.transactionId,
      balanceAfter: newBalance,
      donationId: params.donationId,
      withdrawalId: params.withdrawalId,
      ip: params.ip,
    },
  });

  // 5. Update wallet cache (derived from ledger computation)
  const updatedWallet = await tx.wallet.update({
    where: { userId: params.userId },
    data: {
      currentBalance: newBalance,
      lastTransactionId: txRow.id,
      updatedAt: new Date(),
    },
  });

  return { wallet: updatedWallet, transaction: txRow };
}
```

**Public wrappers (thin):**

```typescript
async creditDonation(tx, p: Omit<FinancialOperationParams, 'amount' | 'type'>) {
  return this.applyFinancialOp(tx, { ...p, amount: p.amount, type: 'donation' });
}
async reserveForWithdrawal(tx, p: Omit<FinancialOperationParams, 'amount' | 'type'>) {
  return this.applyFinancialOp(tx, { ...p, amount: p.amount.negated(), type: 'withdraw_reserve' });
}
async confirmWithdrawal(tx, p: Omit<FinancialOperationParams, 'amount' | 'type'>) {
  return this.applyFinancialOp(tx, { ...p, amount: new Decimal(0), type: 'withdraw_confirm' });
}
async refundWithdrawal(tx, p: Omit<FinancialOperationParams, 'amount' | 'type'>) {
  return this.applyFinancialOp(tx, { ...p, amount: p.amount.abs(), type: 'refund' });
}
```

> **Note on `pendingBalance`:** `reserveForWithdrawal` still increments `pendingBalance`, `confirmWithdrawal` decrements it, and `refundWithdrawal` decrements `pendingBalance` **and** re-credits `currentBalance` via the `refund` ledger entry. `pendingBalance` is an internal reservation tracker; it has no ledger equivalent (by design). `balanceAfter` in the ledger always reflects only `currentBalance`.

- [ ] **Step 1:** Add `FinancialOperationParams` / `FinancialOperationResult` to `dto/wallets.dto.ts`
- [ ] **Step 2:** Add `lockWallet` + private `applyFinancialOp` + 4 public wrappers to `wallets.repositories.ts`
- [ ] **Step 3:** Add `reconcile(userId)`: walk ledger in order, recompute running balance from 0 asserting `balanceAfter[i] == prev + amount[i]`, compare final to `wallet.currentBalance` and `balanceAfter` of `lastTransactionId`; return `{ wallet, ledgerBalance, match }`
- [ ] **Step 4:** Verify compilation via `pnpm build`

---

## Task 2: Donations — delegate wallet/ledger write to `WalletsRepository`

**Files:**
- Modify: `src/infra/db/repositories/donations.repositories.ts`
- Modify: `src/infra/queues/donations/donations-queue.processor.ts` (pass `ip`)

**What changes in `processDonation`:**
- Keeps the donation status-guard (`updateMany where status=pending`)
- Keeps the donation update (status → paid, message, voiceUri, approvedAt)
- **Removes** the inline `tx.wallet.update({ increment, lastTransactionId })` + `tx.transaction.create({...})`
- **Replaces** them with: `await this.walletsRepository.creditDonation(tx, { userId, amount: updatedDonation.amount, transactionId: updatedDonation.transactionId, donationId, ip: updatedDonation.ip })`

- [ ] **Step 1:** Pass `ip` (from the donation row or queue payload) into `ProcessDonationParams`
- [ ] **Step 2:** Refactor `processDonation` to remove inline wallet/ledger writes; call `this.walletsRepository.creditDonation(tx, …)` after updating the donation
- [ ] **Step 3:** Verify compilation via `pnpm build`

---

## Task 3: Withdrawals — delegate wallet/ledger write to `WalletsRepository`

**Files:**
- Modify: `src/infra/db/repositories/dto/withdrawals.dto.ts`
- Modify: `src/infra/db/repositories/withdrawals.repositories.ts`

### 3a: `processWithdrawal` (reserve)

- Remove `grossAmount` from `CreateWithdrawalParams` (it becomes an internal value computed from `netAmount + feeAmount` inside the method)
- **Keep** all withdrawal-create fields (`pixId`, `pixKey`, `keyMasked`, `clientKey`, `netAmount`, `feeAmount`)
- **Remove** the inline `tx.wallet.update({ decrement, pendingBalance: { increment } })` with the P2025 catch, and the inline `tx.transaction.create({ type: 'withdraw_reserve' })`
- **Replace** with: `await this.walletsRepository.reserveForWithdrawal(tx, { userId, amount: grossAmount, transactionId: withdrawal.id, withdrawalId, ip })`
- The P2025 / insufficient-balance catch moves into `WalletsRepository.reserveForWithdrawal`
- The `pendingBalance` increment stays inside `reserveForWithdrawal` (business-logic reservation, not a ledger event)

### 3b: `approveWithdrawal` (confirm)

- **Remove** the inline `tx.wallet.update({ pendingBalance: { decrement } })` + `tx.transaction.create({ type: 'withdraw_confirm' })`
- **Replace** with: `await this.walletsRepository.confirmWithdrawal(tx, { userId, amount: grossAmount, transactionId, withdrawalId, ip })`
- Note: `confirmWithdrawal` writes the `withdraw_confirm` ledger entry with `balanceAfter` unchanged (it only moves `pendingBalance → 0` on the wallet and records the audit row)

### 3c: `rejectWithdrawal` (refund)

- **Remove** the inline `tx.wallet.update({ pendingBalance: { decrement }, currentBalance: { increment } })` + `tx.transaction.create({ type: 'refund' })`
- **Replace** with: `await this.walletsRepository.refundWithdrawal(tx, { userId, amount: grossAmount, transactionId: transactionId ?? '', withdrawalId, ip })`

### 3d: Wiring

- Add `WalletsRepository` to the `WithdrawalsRepository` constructor
- Ensure `WalletsRepository` is listed in `DbModule`'s `providers` and `exports` if it isn't already

- [ ] **Step 1:** Update `dto/withdrawals.dto.ts` — remove `grossAmount` from `CreateWithdrawalParams`
- [ ] **Step 2:** Inject `WalletsRepository` into `WithdrawalsRepository` constructor
- [ ] **Step 3:** Refactor `processWithdrawal` — remove inline wallet/ledger writes, call `reserveForWithdrawal`
- [ ] **Step 4:** Refactor `approveWithdrawal` — remove inline wallet/ledger writes, call `confirmWithdrawal`
- [ ] **Step 5:** Refactor `rejectWithdrawal` — remove inline wallet/ledger writes, call `refundWithdrawal`
- [ ] **Step 6:** Verify compilation via `pnpm build`

---

## Task 4: Reconciliation — nightly cron job

**Files:**
- Create: `src/modules/wallets/wallets-scheduler.service.ts` (follow the `withdrawals-scheduler.service.ts` pattern)
- Modify: `src/modules/wallets/wallets.module.ts`

**Implementation:**

```typescript
@Cron('0 3 * * *') // nightly at 03:00
async reconcileAllWallets() {
  this.logger.log('Starting wallet reconciliation...');
  // page through users (e.g. 100 at a time), call reconcile(userId) for each
  // on mismatch: logger.error('Balance drift detected …') + optional alert metric
}
```

`WalletsRepository.reconcile(userId)` (Task 1, Step 3) performs the actual check: load wallet → if `lastTransactionId` is null, `ledgerBalance = 0` → otherwise walk the ledger from that entry asserting chain integrity → compare final running balance to `wallet.currentBalance` → return match boolean.

- [ ] **Step 1:** Create `WalletsSchedulerService` with the `@Cron` reconcile method
- [ ] **Step 2:** Register it in `WalletsModule`
- [ ] **Step 3:** Verify compilation via `pnpm build`

---

## Task 5: (Optional, recommended) DB-level invariant

Add a deferred `CHECK` constraint or trigger asserting:

```sql
current_balance = (SELECT balance_after FROM transactions WHERE id = last_transaction_id)
```

This blocks direct DB manipulation from silently succeeding. Requires a small migration and careful seeding/test handling — **defer unless the threat model includes insider DBA access**.

---

## Self-Review Checklist

- [ ] Every financial mutation flows through exactly one method (`applyFinancialOp`) in `WalletsRepository`
- [ ] Every new ledger `balanceAfter` is computed from the **previous** ledger entry's `balanceAfter`, never from the wallet row
- [ ] The per-user row lock (`SELECT … FOR UPDATE`) is held for the entire financial transaction
- [ ] The insufficient-funds guard lives in one place (`reserveForWithdrawal`'s negative-amount check)
- [ ] `lastTransactionId` is updated on **every** ledger write (donations, withdrawals reserve/confirm/refund alike)
- [ ] Reconciliation recomputes from the ledger alone (via the pointer) and compares to the wallet cache
- [ ] All existing `$transaction` boundaries are preserved — calls into `WalletsRepository` happen inside the same transaction client (`tx`)
- [ ] `pnpm build` passes after all changes

---

## Execution notes (filled in as tasks complete)

| Task | Notes |
|---|---|
| Task 1 | `WalletsRepository` gained a lean private `applyOp` (lock → self-derive from `lastTransactionId` → append ledger → single wallet cache write) + 4 public wrappers (`creditDonation`, `reserveForWithdrawal`, `confirmWithdrawal`, `refundWithdrawal`) + `reconcile` + `findManyUserIds`. Simplification: removed the planned separate `FinancialOperationParams` DTO; used direct method params. Also fixed semantics so `confirmWithdrawal` uses `delta=0` (keeps reconciliation chain intact). |
| Task 2 | `DonationsRepository.processDonation` now delegates wallet+ledger write to `creditDonation` inside the same `$transaction`. No more inline wallet update / transaction create. |
| Task 3 | `WithdrawalsRepository` injects `WalletsRepository`; `processWithdrawal` calls `reserveForWithdrawal`, `approveWithdrawal` calls `confirmWithdrawal`, `rejectWithdrawal` calls `refundWithdrawal`. All inline wallet/ledger writes removed. P2025 catch removed (insufficient-funds is now a ledger-derived `BadRequestException` from `applyOp`). |
| Task 4 | `WalletsSchedulerService` created (`@Cron(EVERY_DAY_AT_3AM)`), pages wallets in batches of 100, calls `reconcile(userId)`, logs drift via `Logger.error`. Registered in `WalletsModule`. |
| Task 5 | Migration `20260811220000_wallet_balance_ledger_trigger` created: `BEFORE UPDATE` trigger `wallets_balance_guard` on `wallets`. Raises if `current_balance` changed without `last_transaction_id` changing (blocks hand-edits; inserts unaffected so seed + user registration still work). |
| Verify | `tsc --noEmit` clean; `eslint` clean; `nest build` produces `dist/src/...` artifacts successfully. No runtime tests exist; E2E validation deferred to user. |
