# Medium Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 7 Medium-severity findings from the financial audit: withdrawal DTO precision (M1), audit-trail gaps on rejection and reserve (M2, M8), scheduler error visibility + batch limit (M3, M4), donation username enumeration throttle (M6), and donor-paid-amount verification in the queue (M7).

**Architecture:** Clean Architecture preserved — DTOs use `class-validator`, repos own `$transaction` + append-only `Transaction` ledger, contracts remain the abstraction seam, errors are `HttpException` subclasses. `getPixStatus` contract gains one optional field (backward-compatible).

**Tech Stack:** NestJS 11, Prisma 7, `class-validator`, BullMQ, existing global `ThrottlerModule`.

## Global Constraints
- All Prisma calls stay in `src/infra/db/repositories/`
- Financial mutations must use `prisma.$transaction()`
- Errors must be `HttpException` subclasses — no custom filters
- No `process.env` outside bootstrap — use `ConfigService`
- No git commits unless explicitly requested
- No test suite exists — verification = `pnpm build` passes
- **No Prisma migrations** — all changes use existing columns/enums only

---

## File Structure

| File | Change Type | Responsibility |
|---|---|---|
| `src/modules/withdrawals/dto/create-withdrawal.dto.ts` | Modify | Add `@IsPositive()` + `maxDecimalPlaces: 2` + `@Max` (M1) |
| `src/modules/withdrawals/withdrawals.service.ts` | Modify | Pass gateway `transactionId` to `rejectWithdrawal` in webhook path (M2) |
| `src/infra/db/repositories/withdrawals.repositories.ts` | Modify | `rejectWithdrawal` optional `transactionId` (M2); `processWithdrawal` emits `withdraw_reserve` row (M8); `findProcessingWithdrawals` accepts limit (M4) |
| `src/modules/withdrawals/withdrawals-scheduler.service.ts` | Modify | Log caught error with stack (M3); pass batch limit (M4) |
| `src/modules/donations/donations.controller.ts` | Modify | Add `@Throttle` on `getUser(:username)` (M6) |
| `src/infra/gateway/contract/gateway.contract.ts` | Modify | `getPixStatus` returns `{ status, paidAmount? }` (M7) |
| `src/infra/gateway/Efi/efi.service.ts` | Modify | Return `paidAmount` from `valor.original` (M7) |
| `src/infra/queues/donations/donations-queue.processor.ts` | Modify | Compare `donation.amount === paidAmount` (M7) |

---

## Task 1: Withdrawal — DTO precision guards (M1)

**Files:** `src/modules/withdrawals/dto/create-withdrawal.dto.ts`

- [x] Replace `@Min(1)` only with `@IsPositive` + `@Max(999999.99)` + `maxDecimalPlaces: 2` on `amount`.

## Task 2: Withdrawal — scheduler error log + batch limit (M3 + M4)

**Files:** `src/infra/db/repositories/withdrawals.repositories.ts`, `src/modules/withdrawals/withdrawals-scheduler.service.ts`

- [x] `findProcessingWithdrawals(limit = 100)` adds `take` + `orderBy: createdAt asc`
- [x] Scheduler `catch (error)` logs `error.stack` via `Logger.error(msg, stack)`

## Task 3: Withdrawal — reserve ledger + reject transactionId (M2 + M8)

**Files:** `src/infra/db/repositories/withdrawals.repositories.ts`, `src/modules/withdrawals/withdrawals.service.ts`

- [x] `processWithdrawal` captures `updatedWallet` and writes a `withdraw_reserve` `Transaction` row
- [x] `rejectWithdrawal(id, transactionId?)` — persisted on withdrawal and ledger
- [x] Service passes `gatewayResult.transactionId` in the FAILED branch of `handleWebhookPixSend`

## Task 4: Donations — throttle public username lookup (M6)

**Files:** `src/modules/donations/donations.controller.ts`

- [x] `@Throttle({ burst: 10/10s, username_lookup: 60/10min })` on `getUser`

## Task 5: Donations — verify donor paid the expected amount (M7)

**Files:** `src/infra/gateway/contract/gateway.contract.ts`, `src/infra/gateway/Efi/efi.service.ts`, `src/infra/queues/donations/donations-queue.processor.ts`

- [x] `getPixStatus` contract + Efi impl return `{ status, paidAmount? }` using `valor.original`
- [x] Queue processor's `verifyPaymentStatus(signature: (txid, expectedAmount))` uses `Decimal.neq()`; throws `BadRequestException` on mismatch

---

**Self-review:** all 7 selected items covered; M5 skipped (separate plan); no schema migration needed; no breaking changes for callers that ignore `paidAmount` / second `rejectWithdrawal` arg.
