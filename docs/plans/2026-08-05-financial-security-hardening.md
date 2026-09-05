# Financial Security Hardening Implementation Plan
**Pix Webhook · Withdrawals · Admin Approval · Overlay Sanitization**

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 8 security findings across the financial modules: HMAC timing attack, webhook flooding, batch abuse, double-pay race condition, PII exposure, duplicate withdrawals, unvalidated webhook mutations, and overlay XSS.

**Architecture:** All fixes follow the existing Clean Architecture — services stay thin, repositories own `$transaction`, all errors are `HttpException` subclasses, and the global `GlobalExceptionFilter`/`ResponseInterceptor` envelope is preserved. No changes to the AI moderation pipeline (intentionally disabled for testing per user).

**Tech Stack:** NestJS 11, Prisma 7, `node:crypto`, `@nestjs/throttler`, `xss` (already used by `@SanitizeHTML()`), BullMQ.

## Global Constraints
- All Prisma calls stay in `src/infra/db/repositories/` — no exceptions
- Financial mutations must use `prisma.$transaction()`
- Errors must be thrown as `BadRequestException`/`NotFoundException`/`UnauthorizedException` — no custom filters
- No `process.env` outside `main.ts`/`app.module.ts`/`PrismaService` — use `ConfigService`
- Redis keys must have TTL
- New env vars go in `EnvironmentVariables`
- No git commits unless explicitly requested after implementation
- The project currently has **zero `*.spec.ts` files** — no test suite exists. All changed files must compile via `pnpm build`. Runtime end-to-end verification is the user's responsibility.

---

## File Structure (what changes)

| File | Change Type | Responsibility |
|---|---|---|
| `src/modules/webhooks/webhooks.controller.ts` | Modify | HMAC timing-safe compare, throttle, batch-size guard, route path stays `/webhook/pix` |
| `src/modules/withdrawals/withdrawals.service.ts` | Modify | Reordered `approve()` flow, `keyMasked` storage on create, idempotency lookup, validated `handleWebhookPixSend` |
| `src/modules/withdrawals/withdrawals.controller.ts` | Modify | Accept `Idempotency-Key` header, pass to service |
| `src/modules/withdrawals/entities/withdrawal.entity.ts` | Modify | Expose `keyMasked` instead of decrypted `pixValue` |
| `src/infra/db/repositories/dto/withdrawals.dto.ts` | Modify | Add `clientKey`, `keyMasked` to `CreateWithdrawalParams` |
| `src/infra/db/repositories/withdrawals.repositories.ts` | Modify | Include `keyMasked`/`clientKey` on create, add `findByClientKey()` |
| `prisma/schema.prisma` | Modify | Add `keyMasked String` + `clientKey String?` columns on `Withdrawal`, with `@@unique([userId, clientKey])` |
| `prisma/migrations/…` | Created | `pnpm db:migrate` generates automatically |
| `src/modules/donations/entities/overlay-donation.entity.ts` | Modify | Sanitize `message` inside `toResponse()` using `xss` |

---

## Task 1: Webhook — timing-safe HMAC + throttling + batch cap

**Files:**
- Modify: `src/modules/webhooks/webhooks.controller.ts`

**Interfaces:**
- Consumes: existing `EFI_WEBHOOK_SECRET` env var, existing `ThrottlerModule` already global
- Produces: hardened `@Post('webhook/pix')` handler; downstream services unchanged

- [x] **Step 1: Fix HMAC comparison with `timingSafeEqual`**

  Replace the raw `!==` compare with constant-time comparison. Length check MUST come first (short-circuit) because `timingSafeEqual` throws on mismatched lengths.

- [x] **Step 2: Add endpoint-specific throttle**

  `@Throttle({ webhook_burst: { limit: 5, ttl: 1000 }, webhook_sustained: { limit: 20, ttl: 60000 } })`

- [x] **Step 3: Cap `body.pix` array size at 5**

  Throw `BadRequestException` if `transactions.length > 5`.

- [x] **Step 4: Verify compilation** via `pnpm build`

---

## Task 2: Withdrawal — masked key storage + idempotency schema

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/infra/db/repositories/dto/withdrawals.dto.ts`
- Modify: `src/infra/db/repositories/withdrawals.repositories.ts`
- Modify: `src/modules/withdrawals/withdrawals.service.ts`
- Modify: `src/modules/withdrawals/withdrawals.controller.ts`
- Modify: `src/modules/withdrawals/entities/withdrawal.entity.ts`

**Interfaces:**
- Consumes: existing `pix.keyMasked` field on `PixKey` model
- Produces:
  - `Withdrawal.keyMasked: string` (required column)
  - `Withdrawal.clientKey?: string` (optional, unique with userId)
  - `CreateWithdrawalParams` gains `clientKey?: string | null; keyMasked: string`
  - `WithdrawalEntity` exposes `keyMasked`, **removes** `pixValue`
  - `POST /withdrawals` accepts optional `Idempotency-Key` header

- [x] **Step 1: Update Prisma schema** — add columns + composite unique constraint
- [x] **Step 2: Create migration** with `pnpm db:migrate` (manual backfill SQL if table has rows)
- [x] **Step 3: Update repository DTO + create + findByClientKey**
- [x] **Step 4: Update controller** — accept `@Headers('idempotency-key')`
- [x] **Step 5: Update entity** — remove `pixValue`, expose `keyMasked`
- [x] **Step 6: Update service** — store `keyMasked`, idempotency check-first, remove decryption from `mapToEntity`
- [x] **Step 7: Verify compilation**

---

## Task 3: Withdrawal — fix `handleWebhookPixSend` validation

**Files:**
- Modify: `src/modules/withdrawals/withdrawals.service.ts`

**Interfaces:**
- Consumes: existing `withdrawalsRepository.findById`, `approveWithdrawal`, `rejectWithdrawal`
- Produces: webhook handler that validates existence + status + transactionId consistency before mutating

- [x] **Step 1: Rewrite `handleWebhookPixSend`** with existence check, mutable-state guard, transactionId consistency check
- [x] **Step 2: Verify compilation**

---

## Task 4: Admin — fix `approve()` ordering to prevent double-pay race

**Files:**
- Modify: `src/modules/withdrawals/withdrawals.service.ts` (`approve` method)

**Interfaces:**
- Consumes: existing `processingWithdrawal`, `approveWithdrawal`, `rejectWithdrawal`
- Produces: approve flow where state transition (pending → processing) is atomic BEFORE gateway call, with rollback on gateway failure

- [x] **Step 1: Reorder `approve()`** — transition first, then `sendPix`, then persist transactionId; catch → `rejectWithdrawal`
- [x] **Step 2: Verify compilation**

---

## Task 5: Overlay — sanitize donation message in entity

**Files:**
- Modify: `src/modules/donations/entities/overlay-donation.entity.ts`

**Interfaces:**
- Consumes: existing `xss` package
- Produces: `OverlayDonationEntity.toResponse()` returns XSS-safe `message`

- [x] **Step 1: Apply `xss.filterXSS` in `toResponse()`**
- [x] **Step 2: Verify compilation**

---

## Execution notes (filled in as tasks complete)

- **Task 1** — `webhooks.controller.ts`: added `timingSafeEqual` HMAC, `@Throttle` with named throttlers, batch cap 5
- **Task 2** — Schema + migration, repository, DTO, entity, controller, service all updated
- **Task 3** — `handleWebhookPixSend` now validates before mutating
- **Task 4** — `approve()` transitions state before gateway call, rolls back on failure
- **Task 5** — `toResponse()` sanitizes message

**Self-review:** all 8 spec items covered, no placeholders, type consistency verified.
