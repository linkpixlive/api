# MED (Special Return) Handling + Fee-Ledger Entry — Implementation Plan

**Pix MED (Mechanism of Special Return) dispute handling, wallet deficit mechanics, donor consent evidence capture, and explicit platform-fee ledger recognition.**

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Handle involuntary Pix refund requests (MED — *Mechanism of Special Return*) opened by donors via their bank against received donations. Provide admin tooling for per-case review, capture donor consent + user-agent as contest evidence, activate the unused `Wallet.blockedBalance` for the insolvency case, and add an explicit `TransactionType.fee` ledger entry at withdrawal-confirm time so platform revenue is visible in the ledger.

**Architecture:** Clean Architecture preserved — all Prisma calls stay in `src/infra/db/repositories/`, financial mutations remain inside `prisma.$transaction()`, errors are `HttpException` subclasses, MED webhook uses `@Public()` + HMAC shared-secret (mirror of existing `webhook/pix`), new gateway calls go through `GatewayContract`, WebSocket emits are `snake_case` and fired from queue processors (not controllers), new queue follows exact BullMQ conventions from `donations-queue`.

**Context & conversation summary:** The platform charges a 4% fee at withdrawal time (gross credited to wallet at donation receipt, fee deducted when streamer requests withdrawal). The user asked if this makes sense vs. charging at donation time. After analysis, fee-at-withdrawal was confirmed as the industry-standard pattern for creator platforms — no change to fee timing. **However**, the user raised a separate orthogonal concern: Brazilian Pix has a MED (Mechanism of Special Return) mechanism that allows a sender to contact their bank and request a refund for fraud/error/scam. A bad-faith donor could exploit this after hearing their TTS message. The platform has no refund concept in-app (donations are permanent by design), but MED is bank-initiated and arrives via Efi webhook. Decisions made: (1) Manual per-case admin review for all MED notices; (2) Use `Wallet.blockedBalance` (currently unused) when streamer has already withdrawn and wallet can't cover reversal — withhold future withdrawals until solvent; (3) Capture `consentAcceptedAt` + `userAgent` on each donation as contest evidence; (4) Additionally ship an explicit `TransactionType.fee` ledger entry at withdrawal-confirm for platform revenue visibility (pure accounting improvement, preserves fee-at-withdrawal model).

---

## What is already in place (prior work — out of scope)

The following already exist in the codebase and are **not** part of this plan:

- `Wallet.blockedBalance` field exists in schema (`prisma/schema.prisma:125`) with `@default(0)`, but **no repository/service writes to it** — only `wallets.service.ts:20` reads it for the `GET /wallet/balances` endpoint. Phase 5 activates this field.
- `Donation.ip` is captured today (`donations.controller.ts:53` via `@Ip()`, persisted in `donations.service.ts:55-124`).
- Webhook pattern exists at `POST /webhook/pix` (`webhooks.controller.ts:57-93`) with HMAC shared-secret auth, batch-size limit, and fan-out to donations/withdrawals services. Phase 4 mirrors this pattern.
- Queue pattern exists at `donations-queue` (`infra/queues/donations/`) with `attempts: 3, exponential 5000ms, removeOnComplete: true, removeOnFail: 100`. Phase 4 mirrors this exactly.
- `TransactionType` enum (`schema.prisma:33-39`) has values: `donation`, `withdrawal`, `withdraw_reserve`, `withdraw_confirm`, `refund`. Note: `withdrawal` enum literal is **declared but unused in app code**.
- `InteractionType` enum (`schema.prisma:58-63`) has values: `GENERATE_DONATION_QRCODE`, `RESPONSE_WEBHOOK_PIX`, `REQUEST_WITHDRAWAL`, `RESPONSE_WEBHOOK_WITHDRAWAL`.
- `WalletsRepository.applyOp` (`wallets.repositories.ts:98-156`) is the single financial primitive — uses `SELECT ... FOR UPDATE`, computes `balanceAfter` from previous ledger entry, throws `BadRequestException('Saldo insuficiente.')` if `newBalance.isNegative()`, writes `Transaction` row, updates `Wallet` cache. **Currently updates only `currentBalance` and `pendingBalance`** — `blockedBalance` is NOT in the `data:` block (lines 139-145).
- `GatewayContract` (`infra/gateway/contract/gateway.contract.ts`) has 4 methods: `generatePix`, `getPixStatus`, `sendPix`, `getSentPixStatus`. Uses inline object-typed params/returns (no DTO classes).
- `EfiService` extends `GatewayContract`, implements the 4 methods. Token caching at `efi.service.ts:241-252` with 60s safety margin. Each method persists a `GatewayResponse` audit row via `gatewayResponseRepository.create({ interactionType, externalId, payload, provider, statusCode })`.
- `OverlayGateway.emitNewDonation` (`overlay.gateway.ts:69-71`) — `this.server.to(token).emit('new_donation', donation)` — pattern for new WS events.
- Admin module (`src/modules/admin/`) — class-level `@Roles(UserRole.admin)`, `AdminController` with `PATCH /admin/withdrawals/:id/approve|reject`, `PATCH /admin/users/:id/verify`. `AdminModule` imports `GatewayModule`.
- `UserRole` enum exists (used by `RolesGuard`).
- Global pipeline: `GlobalExceptionFilter` + `ResponseInterceptor` envelope. Errors are `HttpException` subclasses only.

---

## Root cause

The platform has no concept of donation reversal or dispute handling. The fee-at-withdrawal model is industry-standard and is NOT being changed. The gap is:

1. **No MED webhook endpoint** — Efi will send MED notifications; the system has nowhere to receive them.
2. **No donation status to represent disputes** — `DonationStatus` enum is `{ pending, paid, displayed, failed, expired }`. No `disputed` or `refunded` state. No code ever reverses a `paid`/`displayed` donation.
3. **No contest evidence** — only `ip` is captured per donation. No consent timestamp, no user-agent. Without evidence, bad-faith MED claims are hard to contest with Efi.
4. **No wallet deficit mechanics** — `blockedBalance` exists but is unused. When a streamer has already withdrawn and a MED is accepted on their donation, `currentBalance` would go negative — `applyOp` throws `Saldo insuficiente.`, blocking the reversal.
5. **No explicit fee revenue in ledger** — the platform fee at withdrawal is implicit (gross debited, net sent). No `Transaction` row with `type='fee'` exists. Revenue reporting requires aggregating `Withdrawal.feeAmount` instead of querying the ledger directly.

## Design goals

| Property | Target |
|---|---|
| **MED posture** | Manual per-case admin review — every MED notice surfaced to admin via `GET /admin/donations/med`, admin accepts or rejects individually |
| **Wallet deficit** | `Wallet.blockedBalance` absorbs the deficit when streamer already withdrew; future withdrawals blocked until `currentBalance > blockedBalance` |
| **Evidence** | `consentAcceptedAt` + `userAgent` (+ existing `ip`) on each `Donation`; queryable as evidence package for Efi contests |
| **Fee visibility** | Explicit `Transaction` row with `type='fee'` at withdrawal-confirm, credited to a designated platform system wallet |
| **No ToS work** | Captured consent is the technical hook; legal/ToS drafting is out of scope |
| **Idempotency** | MED accept/reject are idempotent — `@@index([medRequestId])` + service-layer `ConflictException` guard |
| **Convention compliance** | Every AGENTS.md rule preserved (see cross-cutting check at end) |

---

## Global Constraints

- All Prisma calls stay in `src/infra/db/repositories/` — no exceptions
- Financial mutations must use `prisma.$transaction()`
- Errors must be thrown as `BadRequestException`/`NotFoundException`/`UnauthorizedException`/`ConflictException` — no custom filters, no `res.json()` in controllers
- No `process.env` outside bootstrap — use `ConfigService`
- Redis keys must have TTL (if any new ones are created — this plan introduces none)
- New env vars go in `EnvironmentVariables` class + `.env.example`
- No git commits unless explicitly requested
- The project currently has **zero `*.spec.ts` files** — no test suite exists. Verification = `pnpm build` passes + manual sanity checks. Runtime end-to-end verification is the user's responsibility.
- **Prisma migration IS required** — new enum values, new columns, new index.

---

## File Structure (new and modified files)

```
prisma/
├── schema.prisma                                    [MODIFIED — enums + Donation fields + index]
├── seed.ts                                          [MODIFIED — upsert system user + wallet]
└── migrations/
    └── <timestamp>_med_and_fee_ledger/
        └── migration.sql                           [NEW — auto-generated by prisma migrate]

src/
├── common/
│   ├── config/
│   │   └── env.validation.ts                       [MODIFIED — add PLATFORM_USER_ID]
│   └── interfaces/
│       └── med-request-status.type.ts              [NEW — MedRequestStatus enum]
│
├── modules/
│   ├── admin/
│   │   ├── admin.module.ts                         [MODIFIED — add AdminMedService, import MedQueueModule]
│   │   ├── controllers/
│   │   │   └── admin.controller.ts                [MODIFIED — add 4 MED routes]
│   │   ├── services/
│   │   │   ├── admin-med.service.ts                [NEW — list/get/accept/reject MED logic]
│   │   │   └── admin-withdrawals.service.ts        [UNCHANGED]
│   │   └── dto/
│   │       └── med/
│   │           ├── list-med-query.dto.ts           [NEW]
│   │           └── reject-med.dto.ts               [NEW]
│   │
│   ├── donations/
│   │   ├── donations.controller.ts                 [MODIFIED — @Req() for UA + acceptTerms]
│   │   ├── donations.service.ts                    [MODIFIED — pass UA + consentAcceptedAt]
│   │   ├── dto/
│   │   │   └── donation.dto.ts                     [MODIFIED — add acceptTerms field]
│   │   └── entities/
│   │       └── donation.entity.ts                   [MODIFIED — expose medStatus, refundedAt if visible]
│   │
│   ├── withdrawals/
│   │   └── withdrawals.service.ts                  [MODIFIED — block withdrawals when blockedBalance > 0]
│   │
│   └── webhooks/
│       └── webhooks.controller.ts                  [MODIFIED — add POST /webhook/med]
│
├── infra/
│   ├── db/
│   │   └── repositories/
│   │       ├── wallets.repositories.ts             [MODIFIED — add debitForMedRefund, recordPlatformFee, unblockBalance; modify applyOp for blockedDelta; modify creditDonation for deficit autopay]
│   │       ├── withdrawals.repositories.ts        [MODIFIED — call recordPlatformFee inside approveWithdrawal $transaction]
│   │       └── dto/
│   │           └── donations.dto.ts               [MODIFIED — add userAgent, consentAcceptedAt to CreateDonationParams]
│   │
│   ├── gateway/
│   │   ├── contract/
│   │   │   └── gateway.contract.ts                [MODIFIED — add 3 MED methods]
│   │   └── Efi/
│   │       └── efi.service.ts                      [MODIFIED — implement 3 MED methods]
│   │
│   ├── queues/
│   │   └── med/                                    [NEW dir]
│   │       ├── med-queue.module.ts                 [NEW]
│   │       ├── med-queue.service.ts                [NEW]
│   │       └── med-queue.processor.ts              [NEW]
│   │
│   └── websocket/
│       └── overlay.gateway.ts                      [MODIFIED — add emitDonationRefunded]
│
└── modules/widgets/
    └── overlay.service.ts                          [MODIFIED — add handleMedRefund wrapper]
```

---

## Phase 1 — Schema changes (one migration)

**File:** `prisma/schema.prisma`

### 1.1 Extend `DonationStatus` enum (lines 14-20)

```prisma
enum DonationStatus {
  pending
  paid
  displayed
  failed
  expired
  disputed     // [NEW] MED request opened by donor's bank
  refunded     // [NEW] MED accepted, wallet reversal booked
}
```

### 1.2 Extend `TransactionType` enum (lines 33-39)

```prisma
enum TransactionType {
  donation
  withdrawal
  withdraw_reserve
  withdraw_confirm
  refund
  donation_reversal   // [NEW] wallet debit when MED accepted
  fee                 // [NEW] platform fee revenue credit at withdrawal-confirm
}
```

### 1.3 Extend `InteractionType` enum (lines 58-63)

```prisma
enum InteractionType {
  GENERATE_DONATION_QRCODE
  RESPONSE_WEBHOOK_PIX
  REQUEST_WITHDRAWAL
  RESPONSE_WEBHOOK_WITHDRAWAL
  REQUEST_MED_REFUND   // [NEW]
  RESPONSE_MED_REFUND  // [NEW]
  GET_MED_REQUEST      // [NEW]
}
```

### 1.4 New `MedStatus` enum

```prisma
enum MedStatus {
  open
  accepted
  rejected
  expired
}
```

### 1.5 Extend `UserRole` enum

Add `system` value (for the bootstrap platform user that owns the fee-revenue wallet):

```prisma
// Verify current enum shape in schema.prisma first — add `system` alongside existing values
enum UserRole {
  user
  admin
  system   // [NEW] — bootstrap platform user, owns fee-revenue wallet
}
```

### 1.6 Extend `Donation` model (lines 169-197)

Add fields:

```prisma
model Donation {
  // ... existing fields ...
  userAgent        String?  @map("user_agent") @db.VarChar(512)
  consentAcceptedAt DateTime? @map("consent_accepted_at")
  medRequestId     String?  @map("med_request_id") @db.VarChar(100)
  medStatus        MedStatus? @map("med_status")
  medResolvedAt    DateTime? @map("med_resolved_at")
  refundedAt       DateTime? @map("refunded_at")

  @@index([medStatus])   // [NEW] — admin query for disputed donations
  // ... existing relations, indexes, mapping ...
}
```

### 1.7 Migration command

```bash
pnpm db:migrate --name med_and_fee_ledger
```

### 1.8 Seed system user

**File:** `prisma/seed.ts`

Upsert a system user (idempotent — `upsert` keyed by a known email):

```typescript
// Idempotent upsert of the platform system user
const systemUser = await prisma.user.upsert({
  where: { email: 'system@tipply.internal' },
  update: {},
  create: {
    id: PLATFORM_USER_ID, // read from env or hardcode a known UUID in seed
    email: 'system@tipply.internal',
    name: 'Tipply System',
    role: UserRole.system,
    // ... any other required fields per existing User model
  },
});

await prisma.wallet.upsert({
  where: { userId: systemUser.id },
  update: {},
  create: {
    userId: systemUser.id,
    currentBalance: 0,
    pendingBalance: 0,
    blockedBalance: 0,
  },
});
```

### 1.9 New env var

**File:** `src/common/config/env.validation.ts`

```typescript
@IsUUID('4', { message: 'PLATFORM_USER_ID deve ser um UUID válido' })
@IsNotEmpty({ message: 'PLATFORM_USER_ID não pode estar vazio' })
PLATFORM_USER_ID: string;
```

**File:** `.env.example`

```env
# BUSINESS RULES
WITHDRAWAL_FEE_PERCENTAGE=4
MIN_WITHDRAWAL_AMOUNT=1
PLATFORM_USER_ID=00000000-0000-0000-0000-000000000000
```

### 1.10 Startup validation (recommended)

Add an `OnModuleInit` lifecycle hook in `WithdrawalsRepository` (or a dedicated `StartupValidationService`) that queries the user referenced by `PLATFORM_USER_ID` and fails fast if not found or not `role=system`. Per AGENTS §4.1 spirit — the app should not start if misconfigured.

- [ ] 1.1 Add `disputed`, `refunded` to `DonationStatus` enum
- [ ] 1.2 Add `donation_reversal`, `fee` to `TransactionType` enum
- [ ] 1.3 Add `REQUEST_MED_REFUND`, `RESPONSE_MED_REFUND`, `GET_MED_REQUEST` to `InteractionType` enum
- [ ] 1.4 Add new `MedStatus` enum (`open`, `accepted`, `rejected`, `expired`)
- [ ] 1.5 Add `system` to `UserRole` enum
- [ ] 1.6 Add `userAgent`, `consentAcceptedAt`, `medRequestId`, `medStatus`, `medResolvedAt`, `refundedAt` fields + `@@index([medStatus])` on `Donation` model
- [ ] 1.7 Run `pnpm db:migrate --name med_and_fee_ledger`
- [ ] 1.8 Add system user + wallet upsert to `prisma/seed.ts`; run `pnpm db:seed`
- [ ] 1.9 Add `PLATFORM_USER_ID` to `EnvironmentVariables` + `.env.example`
- [ ] 1.10 (Recommended) Add startup validation that `PLATFORM_USER_ID` references an existing `system` user

---

## Phase 2 — Consent capture at donation time

### 2.1 Extend `DonationDto` with `acceptTerms`

**File:** `src/modules/donations/dto/donation.dto.ts`

```typescript
@ApiProperty({ example: true, description: 'Indica que o doador aceitou os termos de doação não reembolsável' })
@IsBoolean({ message: 'O aceite dos termos deve ser um booleano' })
@IsNotEmpty({ message: 'O aceite dos termos é obrigatório' })
acceptTerms: boolean;
```

**Breaking change note:** This is a breaking change to the donation API — the FE MUST send `acceptTerms: true` going forward. With `whitelist: true` + `forbidNonWhitelisted: true`, donations are rejected at the controller layer if the field is missing or false. Coordinate with FE team to deploy in lock-step. Alternative: make `acceptTerms` `@IsOptional()` during a transition window with a deprecation log, then require after cutoff.

### 2.2 Capture user-agent in controller

**File:** `src/modules/donations/donations.controller.ts` (line ~53)

Switch from `@Ip() ip: string` to `@Req() req: Request` and extract both `ip` and `userAgent`:

```typescript
donation(
  @Body() donationDto: DonationDto,
  @Req() req: Request,
) {
  const ip = req.ip;
  const userAgent = req.headers['user-agent'] ?? null;
  return this.donationsService.donation(donationDto, { ip, userAgent });
}
```

### 2.3 Pass consent + UA through service

**File:** `src/modules/donations/donations.service.ts` (lines 55-124)

Change the signature from `donation(dto, ip: string)` to `donation(dto, ctx: { ip: string; userAgent: string | null })`.

Defensive check (defense-in-depth — DTO already enforces):

```typescript
if (dto.acceptTerms !== true) {
  throw new BadRequestException('Consentimento de doação não registado');
}
```

Pass new fields into `donationsRepository.create(...)`:

```typescript
const donation = await this.donationsRepository.create({
  // ... existing fields ...
  ip: ctx.ip,
  userAgent: ctx.userAgent,
  consentAcceptedAt: new Date(),
});
```

### 2.4 Extend repository DTO

**File:** `src/infra/db/repositories/dto/donations.dto.ts`

Add to `CreateDonationParams`:

```typescript
userAgent?: string | null;
consentAcceptedAt?: Date;
```

### 2.5 Persist new fields in repository

**File:** `src/infra/db/repositories/donations.repositories.ts:55-75`

The `create` method's `data:` block should include `userAgent: params.userAgent` and `consentAcceptedAt: params.consentAcceptedAt`. Prisma handles the rest after migration.

- [ ] 2.1 Add `acceptTerms: boolean` field with `@IsBoolean @IsNotEmpty` to `DonationDto`
- [ ] 2.2 Switch controller from `@Ip()` to `@Req()`; extract `ip` + `userAgent`
- [ ] 2.3 Update `DonationsService.donation` signature to accept `{ ip, userAgent }`; add defensive `acceptTerms` check; pass `userAgent` + `consentAcceptedAt: new Date()` into repository create
- [ ] 2.4 Extend `CreateDonationParams` interface with `userAgent` and `consentAcceptedAt`
- [ ] 2.5 Persist new fields in `DonationsRepository.create`

---

## Phase 3 — Fee-ledger entry at withdrawal-confirm

Pure additive change that introduces explicit platform revenue recognition, preserving the current fee-at-withdrawal cash flow. Every successful withdrawal produces one new `Transaction` row on the platform's wallet with `type='fee'` and `amount=feeAmount`.

### 3.1 Add `recordPlatformFee` to `WalletsRepository`

**File:** `src/infra/db/repositories/wallets.repositories.ts`

New method modeled on `creditDonation` (lines 37-46):

```typescript
async recordPlatformFee(
  tx: Tx,
  params: { userId: string; withdrawalId: string; feeAmount: Decimal },
) {
  if (params.feeAmount.lte(0)) return; // Skip zero-fee withdrawals
  return this.applyOp(tx, {
    userId: params.userId,
    delta: params.feeAmount,          // positive — credits platform wallet
    type: 'fee',
    transactionId: params.withdrawalId,
    withdrawalId: params.withdrawalId,
  });
}
```

**Note on `applyOp` behavior:** The `isNegative()` guard at line 120 passes trivially since `delta > 0`. The platform wallet cannot go negative from a credit.

### 3.2 Call `recordPlatformFee` inside `approveWithdrawal`

**File:** `src/infra/db/repositories/withdrawals.repositories.ts:121-158`

Inside the existing `$transaction` block, after the existing `this.walletsRepository.confirmWithdrawal(tx, ...)` call, add:

```typescript
const platformUserId = this.configService.getOrThrow<string>('PLATFORM_USER_ID');
await this.walletsRepository.recordPlatformFee(tx, {
  userId: platformUserId,
  withdrawalId: withdrawal.id,
  feeAmount: new Decimal(withdrawal.feeAmount),
});
```

Inject `ConfigService` into `WithdrawalsRepository`'s constructor (if not already injected — verify during implementation).

### 3.3 No changes needed elsewhere

- `withdrawals-scheduler.service.ts` and `withdrawals.service.ts` (`handleWebhookPixSend`) both call `approveWithdrawal` — the fee entry is transparent to them.
- `rejectWithdrawal` does NOT reverse the fee (the fee was never credited — `recordPlatformFee` only runs inside `approveWithdrawal`).

- [ ] 3.1 Add `recordPlatformFee` method to `WalletsRepository`
- [ ] 3.2 Inject `ConfigService` into `WithdrawalsRepository`; call `recordPlatformFee` inside `approveWithdrawal`'s `$transaction` after `confirmWithdrawal`
- [ ] 3.3 Verify no other call sites of `approveWithdrawal` need updates

---

## Phase 4 — MED queue + webhook infrastructure

Mirrors the `donations-queue` pattern exactly (per AGENTS §3.3).

### 4.1 Create `med-queue` module

**File:** `src/infra/queues/med/med-queue.module.ts` (new)

```typescript
@Module({
  imports: [
    WebsocketModule,   // for OverlayService emit
    BullModule.registerQueue({
      name: 'med-queue',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    }),
  ],
  providers: [MedQueueService, MedQueueProcessor],
  exports: [MedQueueService],
})
export class MedQueueModule {}
```

### 4.2 Create producer service

**File:** `src/infra/queues/med/med-queue.service.ts` (new)

```typescript
@Injectable()
export class MedQueueService {
  constructor(@InjectQueue('med-queue') private medQueue: Queue) {}

  async openMedRequest(data: { donation_id: string; med_request_id: string }) {
    await this.medQueue.add('med-request-open', data);
  }
}
```

### 4.3 Create processor

**File:** `src/infra/queues/med/med-queue.processor.ts` (new)

```typescript
@Processor('med-queue')
export class MedQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(MedQueueProcessor.name);

  constructor(
    private readonly donationsRepository: DonationsRepository,
    private readonly overlayService: OverlayService,
  ) {
    super();
  }

  async process(job: Job<{ donation_id: string; med_request_id: string }>): Promise<void> {
    const { donation_id, med_request_id } = job.data;
    try {
      // Transition donation to disputed — set medRequestId, medStatus=open
      const donation = await this.donationsRepository.markDisputed(donation_id, med_request_id);
      // Emit WS donation_refunded event (or donation_disputed — see Phase 8)
      await this.overlayService.handleMedOpen(donation);
    } catch (error) {
      this.logger.error(`MED processing failed for donation ${donation_id}: ${error.message}`, error.stack);
      throw error; // re-throw per AGENTS §3.3.5
    }
  }
}
```

**Repository method needed:** `DonationsRepository.markDisputed(donationId, medRequestId)` — sets `status='disputed', medRequestId, medStatus='open'`. Implement with optimistic `updateMany` guard: `where: { id, status: { in: ['paid', 'displayed'] } }` — only dispute `paid`/`displayed` donations, not already-disputed/refunded ones. If `count === 0`, throw `ConflictException('Doação não está em estado elegível para disputa')`.

### 4.4 Add MED webhook endpoint

**File:** `src/modules/webhooks/webhooks.controller.ts` (extend existing file)

Add a new `@Post('webhook/med')` method mirroring the existing `webhookPix` decorator stack:

```typescript
@Post('webhook/med')
@HttpCode(HttpStatus.OK)
@Throttle({
  webhook_burst: { limit: 5, ttl: 1000 },
  webhook_sustained: { limit: 20, ttl: 60000 },
})
@ApiOperation({ summary: 'Webhook MED (Mechanism of Special Return) — ativado quando o banco do doador solicita devolução.' })
@ApiResponse({ status: 200, description: 'Webhook MED recebido com sucesso.' })
@ApiResponse({ status: 400, description: 'Lote excede o tamanho máximo permitido.' })
@ApiResponse({ status: 401, description: 'Não autorizado (HMAC inválido)' })
@ApiResponse({ status: 429, description: 'Muitas requisições.' })
async webhookMed(
  @Query('hmac') hmac: string,
  @Body() body: { med: Record<string, unknown>[] },
) {
  // Reuse HMAC check (refactor to private helper if cleaner)
  // Validate batch size (MAX_WEBHOOK_BATCH = 5)
  // For each MED notification:
  //   - Extract donation txid and med_request_id from payload
  //   - Find donation by transactionId
  //   - If found and status is 'paid' or 'displayed':
  //     - Enqueue med-request-open job: { donation_id, med_request_id }
  //   - Else: log + skip (idempotency — already disputed/refunded)
}
```

**Efi MED payload assumption:** The exact shape of Efi's MED webhook payload must be verified against Efi's API docs during implementation. The controller skeleton + auth + enqueue flow is fully specified; the payload parsing (extracting `txid` + `med_request_id` from the notification) is TBD-by-implementer.

- [ ] 4.1 Create `med-queue.module.ts` with exact BullMQ options from `donations-queue`
- [ ] 4.2 Create `med-queue.service.ts` producer with `openMedRequest({ donation_id, med_request_id })`
- [ ] 4.3 Create `med-queue.processor.ts` extending `WorkerHost`; re-throw errors per AGENTS §3.3.5
- [ ] 4.4 Add `markDisputed` method to `DonationsRepository` with optimistic-lock guard
- [ ] 4.5 Add `POST /webhook/med` endpoint to `WebhooksController` with HMAC auth + batch limit + enqueue
- [ ] 4.6 Register `MedQueueModule` in `AppModule` imports

---

## Phase 5 — Wallet reversal mechanics

The trickiest phase — activates the unused `blockedBalance` for the deficit case.

### 5.1 Extend `applyOp` to support `blockedDelta`

**File:** `src/infra/db/repositories/wallets.repositories.ts`

The `ApplyOpParams` interface (lines 16-25) currently has `delta`, `pendingDelta`, `type`, `transactionId`, `donationId`, `withdrawalId`, `ip`. Add an optional `blockedDelta`:

```typescript
interface ApplyOpParams {
  // ... existing ...
  blockedDelta?: Decimal;  // [NEW] — amount to add/subtract from blockedBalance
}
```

Modify the wallet update block (lines 139-145) to include `blockedBalance`:

```typescript
const newBlockedBalance = (wallet.blockedBalance ?? new Decimal(0)).plus(params.blockedDelta ?? new Decimal(0));
// Only include blockedBalance in the update if blockedDelta is provided
const updateData: any = {
  currentBalance: newBalance,
  pendingBalance: newPendingBalance,
  lastTransactionId: transaction.id,
};
if (params.blockedDelta) {
  updateData.blockedBalance = newBlockedBalance;
}
await tx.wallet.update({ where: { id: wallet.id }, data: updateData });
```

### 5.2 Allow `currentBalance` to reach 0 when `blockedDelta` is supplied

The `isNegative()` guard at line 120 currently throws `'Saldo insuficiente.'` if `newBalance < 0`. For MED reversals with deficit, we want `currentBalance` to reach `0` and the deficit to flow into `blockedBalance`.

Modify the guard:

```typescript
// Existing: if (newBalance.isNegative()) throw ...
// New: allow newBalance to be 0 or negative ONLY when blockedDelta is supplied (sentinel for MED reversal)
if (newBalance.isNegative() && !params.blockedDelta) {
  throw new BadRequestException('Saldo insuficiente.');
}
```

**Important:** When `blockedDelta` is supplied and `newBalance` is negative, clamp `currentBalance` to 0 and move the full deficit into `blockedBalance`:

```typescript
const clampedBalance = newBalance.isNegative() ? new Decimal(0) : newBalance;
const deficit = newBalance.isNegative() ? newBalance.abs() : new Decimal(0);
const newBlockedBalance = (wallet.blockedBalance ?? new Decimal(0))
  .plus(params.blockedDelta ?? new Decimal(0))
  .plus(deficit);
```

Update the wallet row with `currentBalance: clampedBalance, blockedBalance: newBlockedBalance`.

### 5.3 Add `debitForMedRefund` method

**File:** `src/infra/db/repositories/wallets.repositories.ts`

```typescript
async debitForMedRefund(
  tx: Tx,
  params: { donation: Donation; medRequestId: string },
) {
  const amount = new Decimal(params.donation.amount);
  return this.applyOp(tx, {
    userId: params.donation.userId,
    delta: amount.negated(),                  // debit
    type: 'donation_reversal',
    transactionId: params.medRequestId,
    donationId: params.donation.id,
    blockedDelta: undefined,                  // let applyOp compute deficit
  });
}
```

Wait — re-examine: `applyOp` computes `newBalance = prevBalance + delta`. If `delta = -amount` and `prevBalance < amount`, newBalance is negative. With the `blockedDelta` sentinel trick above, we'd need to signal "allow deficit." Better approach: pass `blockedDelta: new Decimal(0)` as a sentinel that says "this is a MED reversal — allow deficit and compute blockedAmount automatically."

**Refined `applyOp` change:**

```typescript
// In applyOp, after computing newBalance:
if (newBalance.isNegative() && !params.allowDeficit) {
  throw new BadRequestException('Saldo insuficiente.');
}
const clampedBalance = newBalance.isNegative() ? new Decimal(0) : newBalance;
const deficit = newBalance.isNegative() ? newBalance.abs() : new Decimal(0);
const newBlockedBalance = (wallet.blockedBalance ?? new Decimal(0))
  .plus(params.blockedDelta ?? new Decimal(0))
  .plus(deficit);
```

Add `allowDeficit?: boolean` to `ApplyOpParams`. `debitForMedRefund` passes `allowDeficit: true`.

### 5.4 Add `unblockBalance` method (admin-only, optional)

**File:** `src/infra/db/repositories/wallets.repositories.ts`

Admin-only path to manually write off a deficit after the platform absorbs it. Operates symmetrically: `blockedBalance -= amount`. Use sparingly.

```typescript
async unblockBalance(tx: Tx, params: { userId: string; amount: Decimal; reason: string }) {
  return this.applyOp(tx, {
    userId: params.userId,
    delta: new Decimal(0),                  // no currentBalance change
    type: 'donation_reversal',              // or a new admin-specific type
    blockedDelta: params.amount.negated(),  // reduce blocked
    transactionId: `unblock-${Date.now()}`,
    // Note: this is the only place blockedDelta is passed explicitly with a negative value
  });
}
```

### 5.5 Deficit auto-clear on next donation (recommended)

**File:** `src/infra/db/repositories/wallets.repositories.ts` — modify `creditDonation`

When a future `creditDonation` arrives and `blockedBalance > 0`, the credit first pays down `blockedBalance` (until 0), then accrues to `currentBalance`:

```typescript
async creditDonation(tx: Tx, donation: Donation) {
  const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: donation.userId } });
  const blocked = wallet.blockedBalance ?? new Decimal(0);
  if (blocked.gt(0)) {
    const credit = new Decimal(donation.amount);
    const appliedToBlock = Decimal.min(credit, blocked);
    const remainder = credit.minus(appliedToBlock);
    // Pay down blocked first, then credit remainder to currentBalance
    return this.applyOp(tx, {
      userId: donation.userId,
      delta: remainder,
      type: 'donation',
      transactionId: donation.transactionId,
      donationId: donation.id,
      ip: donation.ip,
      blockedDelta: appliedToBlock.negated(),  // reduce blockedBalance
    });
  }
  return this.applyOp(tx, {
    userId: donation.userId,
    delta: new Decimal(donation.amount),
    type: 'donation',
    transactionId: donation.transactionId,
    donationId: donation.id,
    ip: donation.ip,
  });
}
```

**Recommendation:** Implement this — it's symmetric with banking "negative ledger" accounting and avoids dead blocked balances lingering forever.

### 5.6 Block withdrawals when `blockedBalance > 0`

**File:** `src/modules/withdrawals/withdrawals.service.ts:55-86` (`create` method)

After fetching the wallet, add:

```typescript
const available = wallet.currentBalance.minus(wallet.blockedBalance);
if (new Decimal(dto.amount).gt(available)) {
  throw new BadRequestException('Saldo insuficiente. Há valores bloqueados por disputas MED.');
}
```

**Note:** `wallets.service.ts:20` already exposes `blockedBalance` as `blocked` in `WalletBalancesEntity` — no change needed, the value flows to FE.

- [ ] 5.1 Add `blockedDelta` + `allowDeficit` to `ApplyOpParams`; modify `applyOp` to write `blockedBalance` and allow deficit when `allowDeficit=true`
- [ ] 5.2 Add `debitForMedRefund` method to `WalletsRepository` with `allowDeficit: true`
- [ ] 5.3 Add `unblockBalance` method (admin-only, optional)
- [ ] 5.4 Modify `creditDonation` to auto-pay `blockedBalance` first when `blockedBalance > 0`
- [ ] 5.6 Add available-balance check (currentBalance - blockedBalance) to `WithdrawalsService.create`

---

## Phase 6 — Gateway contract extension for MED

### 6.1 Add `MedRequestStatus` type

**File:** `src/common/interfaces/med-request-status.type.ts` (new)

```typescript
export enum MedRequestStatus {
  OPEN = 'open',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}
```

### 6.2 Extend `GatewayContract` with three MED methods

**File:** `src/infra/gateway/contract/gateway.contract.ts`

Add after `getSentPixStatus` (line ~20), using inline object-typed params/returns per existing convention:

```typescript
abstract getMedRequest(medRequestId: string): Promise<{
  status: MedRequestStatus;
  donationTransactionId: string;
  amount: number;
  expiresAt: Date;
}>;

abstract acceptMedRefund(medRequestId: string): Promise<{
  status: string;
  transactionId: string;
}>;

abstract rejectMedRefund(medRequestId: string, reason: string): Promise<{
  status: string;
}>;
```

### 6.3 Implement in `EfiService`

**File:** `src/infra/gateway/Efi/efi.service.ts`

Override the three new methods following the existing pattern:

1. Get cached OAuth token via `getAccessToken()` (lines 241-252).
2. Call Efi's MED endpoints via `firstValueFrom(this.httpService.{get|post}<EfiXxxResponse>(url, body, { headers, httpsAgent }))`.
3. Persist `GatewayResponse` audit row via `gatewayResponseRepository.create({ interactionType: 'REQUEST_MED_REFUND' | 'RESPONSE_MED_REFUND' | 'GET_MED_REQUEST', externalId: medRequestId, payload: JSON.stringify(data), provider: 'efi', statusCode })`.
4. Map Efi-specific status strings to the common `MedRequestStatus` enum (mirror `mapEfiSentPixStatus` at lines 148-160).
5. Return the common-shaped response.

**Efi MED API verification:** The exact Efi MED endpoint URLs and payload shapes must be verified against Efi's API docs (or developer support) during implementation. The contract/abstraction pattern lets us stub the implementation cleanly until verified. Mark the EfiService methods with `// TODO: verify against Efi MED API docs` placeholders. Until verified, the MED webhook can run in "log-only" mode: persist the raw payload as a `GatewayResponse` row and enqueue only enough info for the admin UI — manual review proceeds even before automated accept/reject calls work.

- [ ] 6.1 Create `med-request-status.type.ts` with `MedRequestStatus` enum
- [ ] 6.2 Add three abstract MED methods to `GatewayContract`
- [ ] 6.3 Implement the three methods in `EfiService` with `GatewayResponse` audit + status mapping; stub with TODOs for Efi API verification

---

## Phase 7 — Admin MED review endpoints

### 7.1 Create `AdminMedService`

**File:** `src/modules/admin/services/admin-med.service.ts` (new)

```typescript
@Injectable()
export class AdminMedService {
  constructor(
    private readonly donationsRepository: DonationsRepository,
    private readonly walletsRepository: WalletsRepository,
    private readonly gatewayContract: GatewayContract,
    private readonly overlayService: OverlayService,
    private readonly prismaService: PrismaService,
  ) {}

  async listDisputed(query: ListMedQueryDto): Promise<...> { ... }
  async getEvidence(donationId: string): Promise<...> { ... }
  async accept(donationId: string): Promise<...> { ... }
  async reject(donationId: string, reason: string): Promise<...> { ... }
}
```

**`listDisputed(query)`:** Query `Donation` rows where `medStatus = 'open'`, paginated, sorted by `medResolvedAt desc nulls first` (most recent disputes first). Returns DTO with `id, amount, name, message, ip, userAgent, consentAcceptedAt, createdAt, medRequestId, medStatus`.

**`getEvidence(donationId)`:** Returns the full evidence package for a single disputed donation: `{ ip, userAgent, consentAcceptedAt, amount, transactionId, message, createdAt, name, medRequestId, medStatus }`. Used by admin to draft the contest response to Efi.

**`accept(donationId)`:** Idempotency check first — if `donation.medStatus === 'accepted'`, throw `ConflictException('MED já aceitado')`. Then inside a single `$transaction`:

```typescript
return await this.prismaService.$transaction(async (tx) => {
  // 1. Re-fetch donation with row lock
  const donation = await tx.donation.findUniqueOrThrow({ where: { id: donationId } });
  if (donation.medStatus === 'accepted') {
    throw new ConflictException('MED já aceitado');
  }

  // 2. Call gateway to accept the MED with Efi (outside tx? or inside? — see note below)
  //    NOTE: Gateway calls are I/O and should ideally be OUTSIDE the $transaction.
  //    Pattern: call gateway first, then open $transaction for the DB mutations.
  //    Refactor: move gateway call before $transaction, then pass result into tx.

  // 3. Debit the streamer's wallet (handles deficit via blockedBalance)
  await this.walletsRepository.debitForMedRefund(tx, {
    donation,
    medRequestId: donation.medRequestId!,
  });

  // 4. Update donation status
  const updated = await tx.donation.update({
    where: { id: donationId },
    data: {
      status: DonationStatus.refunded,
      medStatus: MedStatus.accepted,
      medResolvedAt: new Date(),
      refundedAt: new Date(),
    },
  });

  return updated;
});

// After $transaction commits, emit WS event
await this.overlayService.handleMedRefund(overlay, donationId);
```

**Gateway call placement — important:** I/O calls (HTTP to Efi) should be OUTSIDE the `$transaction` to avoid holding the DB transaction open during network latency. The pattern should be:

1. Call `gatewayContract.acceptMedRefund(medRequestId)` — get `{ transactionId }`.
2. Open `$transaction` → `debitForMedRefund` + `donation.update` → commit.
3. After commit → emit WS `donation_refunded`.

This mirrors the existing `AdminWithdrawalsService.approve` pattern (`admin-withdrawals.service.ts:18-49`) where `gatewayContract.sendPix` is called BEFORE `withdrawalsRepository.approveWithdrawal`.

**`reject(donationId, reason)`:** Idempotency check — if `donation.medStatus === 'rejected'`, throw `ConflictException`. Then:

1. Call `gatewayContract.rejectMedRefund(medRequestId, reason)`.
2. Update donation: `medStatus='rejected', medResolvedAt=new Date()`. Status stays as-is (if `displayed`, stays `displayed`; if `paid`, stays `paid` — the MED was rejected, no reversal).
3. No wallet change.
4. After commit — emit WS (optional `donation_dispute_resolved` event, or skip — admin-only concern).

### 7.2 Add admin controller routes

**File:** `src/modules/admin/controllers/admin.controller.ts` (extend existing)

Add four routes — all behind class-level `@Roles(UserRole.admin)`:

```typescript
@Get('admin/donations/med')
@ApiOperation({ summary: 'Listar doações em disputa MED' })
@ApiResponse({ status: 200, description: 'Lista paginada de doações disputadas.' })
@ApiResponse({ status: 401, description: 'Não autorizado.' })
@ApiResponse({ status: 403, description: 'Acesso negado (requer admin).' })
listDisputedMed(@Query() query: ListMedQueryDto) {
  return this.adminMedService.listDisputed(query);
}

@Get('admin/donations/:id/med')
@ApiOperation({ summary: 'Obter evidência de doação disputada' })
@ApiResponse({ status: 200, description: 'Pacote de evidência para contestação MED.' })
@ApiResponse({ status: 404, description: 'Doação não encontrada.' })
getMedEvidence(@Param('id') id: string) {
  return this.adminMedService.getEvidence(id);
}

@Post('admin/donations/:id/med/accept')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Aceitar devolução MED e reverter wallet' })
@ApiResponse({ status: 200, description: 'MED aceitado, wallet debitada.' })
@ApiResponse({ status: 404, description: 'Doação não encontrada.' })
@ApiResponse({ status: 409, description: 'MED já resolvido.' })
acceptMed(@Param('id') id: string) {
  return this.adminMedService.accept(id);
}

@Post('admin/donations/:id/med/reject')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Rejeitar devolução MED' })
@ApiResponse({ status: 200, description: 'MED rejeitado, doação permanece paga.' })
@ApiResponse({ status: 404, description: 'Doação não encontrada.' })
@ApiResponse({ status: 409, description: 'MED já resolvido.' })
rejectMed(@Param('id') id: string, @Body() dto: RejectMedDto) {
  return this.adminMedService.reject(id, dto.reason);
}
```

### 7.3 Create DTOs

**File:** `src/modules/admin/dto/med/list-med-query.dto.ts` (new)

```typescript
export class ListMedQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional() @IsInt() @Min(1) page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number = 20;

  @ApiProperty({ required: false, enum: MedStatus })
  @IsOptional() @IsEnum(MedStatus) status?: MedStatus;
}
```

**File:** `src/modules/admin/dto/med/reject-med.dto.ts` (new)

```typescript
export class RejectMedDto {
  @ApiProperty({ example: 'Doação legítima com consentimento registado.', maxLength: 500 })
  @IsString() @IsNotEmpty() @MaxLength(500) reason: string;
}
```

### 7.4 Update `AdminModule`

**File:** `src/modules/admin/admin.module.ts`

```typescript
@Module({
  imports: [GatewayModule, MedQueueModule],   // [MODIFIED — add MedQueueModule if needed for emit]
  controllers: [AdminController],
  providers: [
    AdminWithdrawalsService,
    AdminUsersService,
    AdminMedService,          // [NEW]
    SecurityService,
  ],
})
export class AdminModule {}
```

**Note:** `AdminMedService` calls the gateway directly (accept/rejectMED) — it does NOT need `MedQueueModule` unless we decide the accept flow should enqueue a `med-resolved` job instead of emitting WS inline. Per AGENTS §3.1.7, "Emit from Queue Processors, not Controllers." However, admin "accept" is a rare, admin-triggered synchronous action, not a high-volume webhook-driven flow. **Recommendation:** emit WS directly from `AdminMedService.accept` (after `$transaction` commits), documented as an explicit exception. If the team prefers strict queue-only emits, a `med-resolved` job can be enqueued instead — but the added complexity isn't warranted for low-frequency admin actions.

- [ ] 7.1 Create `AdminMedService` with `listDisputed`, `getEvidence`, `accept`, `reject` methods
- [ ] 7.2 Add four admin routes to `AdminController`: `GET /admin/donations/med`, `GET /admin/donations/:id/med`, `POST /admin/donations/:id/med/accept`, `POST /admin/donations/:id/med/reject`
- [ ] 7.3 Create `ListMedQueryDto` and `RejectMedDto` with `class-validator` decorators
- [ ] 7.4 Add `AdminMedService` to `AdminModule` providers; import `MedQueueModule` if needed

---

## Phase 8 — WebSocket events

### 8.1 Add `emitDonationRefunded` to `OverlayGateway`

**File:** `src/infra/websocket/overlay.gateway.ts` (after line ~100)

```typescript
emitDonationRefunded(token: string, donationId: string) {
  this.server.to(token).emit('donation_refunded', { id: donationId });
}
```

Event name `donation_refunded` — snake_case per AGENTS §3.1.6. Target: `this.server.to(token).emit(...)` — room-scoped, never broadcast (per AGENTS §3.1.3).

### 8.2 Add `handleMedRefund` wrapper to `OverlayService`

**File:** `src/modules/widgets/overlay.service.ts`

```typescript
async handleMedRefund(overlay: Widget, donationId: string) {
  const token = overlay.token;
  const isOnline = await this.redisService.get<string>(`overlay:${token}`);
  if (!isOnline) return;
  this.overlayGateway.emitDonationRefunded(token, donationId);
}
```

### 8.3 Emit source — admin service (not queue processor)

Per AGENTS §3.1.7, "Emit from Queue Processors, not Controllers." The MED accept flow is admin-triggered (not webhook-driven). **Decision:** emit directly from `AdminMedService.accept` after `$transaction` commits, documented as an explicit exception since:
- Acceptances are rare, admin-triggered, synchronous actions.
- Adding a queue just for WS emit would be over-engineering for a low-frequency path.

If the team prefers strict queue-only emits, a `med-resolved` job can be enqueued instead — but the added complexity isn't warranted for low-frequency admin actions. Document either choice as a code comment.

### 8.4 FE contract change

The FE handling `donation_refunded` should:
- Drop the alert if currently displaying the affected donation's alert.
- Skip the TTS audio (already played — nothing to undo there, but FE should not replay).
- Remove the donation from the overlay queue (Redis `overlay:queue:<token>` list).

This is a FE contract change — coordinate with FE team.

- [ ] 8.1 Add `emitDonationRefunded(token, donationId)` to `OverlayGateway`
- [ ] 8.2 Add `handleMedRefund(overlay, donationId)` wrapper to `OverlayService`
- [ ] 8.3 Emit `donation_refunded` from `AdminMedService.accept` after `$transaction` commits (documented exception to §3.1.7)
- [ ] 8.4 (FE coordination) Document the `donation_refunded` event contract for the FE team

---

## Phase 9 — Documentation

| File | Change |
|---|---|
| `.env.example` | Already updated in Phase 1 (`PLATFORM_USER_ID`) |
| `src/modules/donations/entities/donation.entity.ts` | Expose `medStatus` and `refundedAt` to streamer (they should know when a donation was reversed); keep `userAgent` and `consentAcceptedAt` private (donor evidence, not for streamer) |
| AGENTS.md | No new Redis keys, no new file-key patterns, no new TTS storage — conventions tables unchanged |
| This plan doc | `docs/superpowers/plans/2026-08-12-med-and-fee-ledger.md` (this file) |

- [ ] 9.1 Expose `medStatus` and `refundedAt` in `DonationEntity` (streamer-facing)
- [ ] 9.2 Confirm `userAgent` and `consentAcceptedAt` are NOT exposed in `DonationEntity` (admin-only)

---

## Cross-cutting conventions check

| AGENTS.md Rule | Status |
|---|---|
| Controllers are thin | Phase 2 controller extracts headers + delegates; Phase 7 admin controllers delegate entirely to `AdminMedService` |
| All DB operations via repositories | `WalletsRepository.debitForMedRefund`, `recordPlatformFee`, `DonationsRepository.markDisputed` — all in `infra/db/repositories` |
| Financial mutations in `$transaction` | `debitForMedRefund` and `recordPlatformFee` run inside caller's `$transaction` (mirrors `refundWithdrawal`) |
| External integrations via abstract Contracts | `GatewayContract` extended with three new abstract methods |
| Concrete provider binding | `GatewayModule` already binds `{ provide: GatewayContract, useClass: EfiService }` — no change needed |
| Errors as `HttpException` subclasses | All new throw sites (`BadRequestException`, `NotFoundException`, `ConflictException`) |
| No `res.json()` in controllers | All controllers return values directly — `ResponseInterceptor` wraps |
| No custom `ExceptionFilter` | None added |
| WS events `snake_case` | `donation_refunded` matches `new_donation`, `skip_alert` |
| WS events throttled | MED webhook uses named throttlers `webhook_burst` / `webhook_sustained` |
| Emit from queue processors (not controllers) | MED open emits from `MedQueueProcessor`; MED accept emits from `AdminMedService` (documented exception — admin-triggered, low frequency) |
| Queue naming + retry policy | `med-queue` kebab-case, exponential 5000ms, 3 attempts, removeOnComplete=true, removeOnFail=100 |
| BullMQ processors re-throw errors | `MedQueueProcessor.process` re-throws on error |
| Env vars validated at startup | `PLATFORM_USER_ID` added to `EnvironmentVariables` |
| No `process.env` outside bootstrap | All env reads via `ConfigService.getOrThrow` |
| No Redis keys without TTL | No new Redis keys introduced |
| DTOs use `class-validator` | Phase 2 `acceptTerms`, Phase 7 `ListMedQueryDto`, `RejectMedDto` — all decorated |
| No sensitive data in responses | `userAgent` and `consentAcceptedAt` are admin-only; `DonationEntity` exposes `medStatus`/`refundedAt` only |

---

## Verification plan (post-implementation)

| Step | Command / Action | Expected Result |
|---|---|---|
| Apply migration | `pnpm db:migrate --name med_and_fee_ledger` | Migration applies cleanly; Prisma client regenerated |
| Seed system user | `pnpm db:seed` | System user + wallet upserted; `PLATFORM_USER_ID` set in `.env` |
| Typecheck | `pnpm build` | Compiles without errors |
| Lint | `pnpm lint` | No lint errors |
| Donation without consent | `POST /donation` with `acceptTerms: false` or missing | `400 Bad Request` — "O aceite dos termos é obrigatório" |
| Donation with consent | `POST /donation` with `acceptTerms: true` | `201 Created` — donation row has `consentAcceptedAt` + `userAgent` populated |
| Withdrawal + fee ledger | Create + approve a withdrawal | Platform wallet has new `Transaction` row with `type='fee'`, `amount=feeAmount` |
| MED webhook | `POST /webhook/med` with valid HMAC + payload | `200 OK`; donation transitions to `disputed`, `medStatus='open'` |
| Admin list disputed | `GET /admin/donations/med` (as admin) | Returns list with disputed donations |
| Admin get evidence | `GET /admin/donations/:id/med` (as admin) | Returns evidence package (ip, userAgent, consentAcceptedAt, etc.) |
| Admin accept MED (wallet sufficient) | `POST /admin/donations/:id/med/accept` | Donation → `refunded`, wallet debited by `donation.amount`, WS `donation_refunded` emitted |
| Admin accept MED (wallet insufficient) | `POST /admin/donations/:id/med/accept` on streamer who already withdrew | Donation → `refunded`, `currentBalance=0`, `blockedBalance=deficit`, WS emitted |
| Withdrawal blocked by blockedBalance | Streamer with `blockedBalance > 0` requests withdrawal | `400 Bad Request` — "Saldo insuficiente. Há valores bloqueados por disputas MED." |
| Deficit auto-clear | New donation arrives to streamer with `blockedBalance > 0` | `blockedBalance` reduced first, remainder credited to `currentBalance` |
| Admin reject MED | `POST /admin/donations/:id/med/reject` | Donation stays `paid`/`displayed`, `medStatus='rejected'`, no wallet change |
| Idempotency — accept twice | `POST /admin/donations/:id/med/accept` twice | Second call returns `409 Conflict` — "MED já aceitado" |

---

## Risks and open items

1. **Efi MED API contract** — The exact shape of Efi's MED webhook payload and MED accept/reject endpoints must be verified against Efi's docs (or developer support). The plan deliberately leaves `EfiService` method bodies as filled-in skeletons with TODOs for verification. Until verified, the MED webhook can run in "log-only" mode: persist the raw payload as a `GatewayResponse` row, enqueue admin-displayable info, and let manual review proceed even before automated accept/reject calls work.

2. **`displayed → refunded` transition** — First time the system ever reverts a paid donation's status. Existing dashboard aggregations in `dashboard.repositories.ts` sum `amount` over `Donation` rows — a `refunded` donation should subtract from totals, not add. Follow-up ticket: add `WHERE status != 'refunded'` to dashboard queries (or surface the metric as "gross donations" vs "net after MED").

3. **`acceptTerms` is a breaking change** to the donation API. FE MUST coordinate deployment; otherwise all donations fail until FE sends the field. Alternative: make `acceptTerms` `@IsOptional()` during a transition window with a deprecation log, then require after cutoff date.

4. **System user existence** — If `PLATFORM_USER_ID` env var references a non-existent user, Phase 3's `approveWithdrawal` will throw `NotFoundException` on every withdrawal. Mitigation: startup validation hook (Phase 1.10) that validates the env var points to an existing `UserRole.system` user — fail-fast on boot.

5. **Refund of a withdrawal's underlying donation after fee-ledger entry was made** — If a MED is accepted on a donation whose fee was already credited to the platform wallet (donation → withdrawal → confirm → fee credit, then someone MED-disputes the original donation): the platform's `fee` `Transaction` row is NOT reversed by this plan. That's intentional — the platform earned the fee when the Pix went out. If the business later decides to "refund the fee too," that's a Phase 10+ addition. Out of scope for now.

6. **`withdrawal` enum value still unused** — The `TransactionType.withdrawal` enum literal (declared at `schema.prisma:35`) is not referenced anywhere in app code (per prior research). This plan does not clean it up. Verify during implementation whether it's referenced in any new code — if not, leave it as-is to avoid a separate migration just to drop an unused enum value.

7. **`MedQueueModule` imports** — The processor needs `WebsocketModule` (for `OverlayService`) and a way to access `DonationsRepository`. Verify during implementation whether `DbModule` is `@Global()` or needs explicit import in `MedQueueModule`. The existing `DonationsQueueModule` does NOT explicitly import `DbModule` — it likely works because `DbModule` is global. Follow whatever pattern is confirmed.

---

## Recommended implementation order

1. **Phase 1 + Phase 3** — schema migration + fee-ledger. Pure additive, low risk. Immediate platform revenue visibility. Ship first.
2. **Phase 2** — consent capture (with FE coordination). Can ship in parallel with Phase 1.
3. **Phases 4 + 5 + 8** — wallet deficit mechanics, MED webhook skeleton, WS events. Groundwork.
4. **Phases 6 + 7** — gateway contract extension + admin endpoints. The actual MED handling.
5. **Phase 9** — docs cleanup + entity exposure.

Phases 1+3 can ship within days with minimal risk. Phases 4-7 form the MED feature proper — estimate ~3-5 days for one engineer, pending Efi MED API verification.
