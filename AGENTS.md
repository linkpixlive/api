# 📜 RULES.md — Tipply Backend Coding Laws

> **Authority:** This document is the single source of truth for coding standards in `tipply-backend`.
> Any code (human or AI-generated) that violates these rules MUST be rejected in review.

---

## 1. 🏗️ Architecture — Clean Architecture Boundaries

### 1.1 Layer Hierarchy

```
Controller → Service → Repository / Contract
     ↓           ↓              ↓
  HTTP I/O    Orchestration   Persistence & External I/O
```

| Layer | Allowed | Prohibited |
|---|---|---|
| **Controller** (`modules/*/_.controller.ts`) | Receive HTTP/WS input, validate via DTOs, delegate to Service, return response | Business logic, direct Prisma calls, direct Redis calls, `try/catch` for business errors |
| **Service** (`modules/*/_.service.ts`) | Orchestrate business flow, coordinate Repositories and Contracts, throw NestJS `HttpException` subclasses | Direct `PrismaService` usage, raw SQL, infrastructure details (R2 keys, TTS URLs, Efi internals) |
| **Repository** (`infra/db/repositories/_.ts`) | Prisma CRUD, typed DTOs for params, `$transaction` blocks | Business rules, HTTP exceptions, calling other Services |
| **Contract** (`infra/*/contract/_.contract.ts`) | Abstract class defining the interface for external services | Implementation details |
| **Infrastructure Provider** (`infra/*/\<provider\>/_.service.ts`) | Implement Contract, encapsulate vendor SDK | Exposure of vendor types to modules layer |

### 1.2 Mandatory Rules

1. **Controllers are thin.** They receive, validate (via `class-validator` DTOs + `ValidationPipe`), delegate, and return. Zero business logic.
2. **Services orchestrate.** They call Repositories and Contracts. They decide *what* happens, never *how* the database or external API works internally.
3. **Repositories own persistence.** All Prisma calls live in `infra/db/repositories/`. No Prisma calls outside this directory — no exceptions.
4. **Contracts decouple infrastructure.** Every external integration (Payment Gateway, Storage, TTS, AI) MUST have an abstract Contract class. The module layer depends on the Contract, never on the concrete provider.
5. **Dependency Injection via abstract tokens.** Provider bindings use `{ provide: ContractClass, useClass: ConcreteService }` pattern. Modules import the infra module, never the concrete service directly.
6. **No circular dependencies.** If Module A needs Module B's provider, Module B must export it. Never use `forwardRef` unless absolutely unavoidable (and document why).

### 1.3 File & Directory Conventions

```
src/
├── common/           # Shared: filters, interceptors, decorators, interfaces, config, security
├── infra/            # Infrastructure: db, redis, websocket, storage, gateway, ai, speech, queues
│   ├── <domain>/
│   │   ├── contract/     # Abstract class (interface)
│   │   ├── <provider>/   # Concrete implementation
│   │   └── <domain>.module.ts
├── modules/          # Business modules: auth, donations, dashboard, withdrawals
│   ├── <module>/
│   │   ├── dto/          # Input validation DTOs (class-validator)
│   │   ├── entities/     # Response/output entities
│   │   ├── <module>.controller.ts
│   │   ├── <module>.service.ts
│   │   └── <module>.module.ts
└── templates/        # Email Handlebars templates
```

- **Repository files:** `<entity>.repositories.ts` inside `infra/db/repositories/`
- **Repository DTOs:** `infra/db/repositories/dto/<entity>.dto.ts` — typed params for create/update operations
- **Module DTOs:** `modules/<module>/dto/` — input validation with `class-validator` decorators
- **Naming:** `kebab-case` for file names, `PascalCase` for classes, `camelCase` for methods/properties

---

## 2. 🔄 Data Flow — Prisma & Redis Patterns

### 2.1 Prisma Rules

1. **All DB access goes through Repository classes.** Direct `PrismaService` usage is banned outside `infra/db/repositories/`.
2. **Use `$transaction` for multi-step financial operations.** Any operation that modifies `Wallet`, creates `Transaction`, and updates `Donation` MUST be wrapped in a `prisma.$transaction()` block to guarantee atomicity. Reference: `TransactionsRepository.processDonation()`.
3. **Repository methods accept typed DTOs.** Never pass raw objects. Define params in `infra/db/repositories/dto/`:

   ```typescript
   // ✅ CORRECT
   async create(data: CreateDonationParams) { ... }
   
   // ❌ WRONG
   async create(data: any) { ... }
   ```

4. **Repository methods return Prisma types directly.** No manual mapping inside repositories — let the Service layer select/transform what it needs.
5. **Use Prisma enums from the schema.** Status values like `DonationStatus`, `PaymentMethod`, `TransactionType` come from `@prisma/client`. Prefer these over hardcoded strings.
6. **Indexes are mandatory** for any field used in `where`, `orderBy`, or frequent lookups. Keep `schema.prisma` `@@index()` declarations up to date.
7. **Migrations follow the workflow:**
   ```bash
   pnpm db:migrate    # Development (creates migration + generates client)
   pnpm db:deploy     # Production (applies pending migrations only)
   ```

### 2.2 Redis Rules

1. **Redis key naming convention:** Hierarchical, colon-separated, lowercase:

   | Pattern | Example | TTL |
   |---|---|---|
   | `overlay:<overlay_key>` | `overlay:a1b2c3d4-...` | 60s (heartbeat) |
   | `otp:verification:<email>` | `otp:verification:user@mail.com` | 600s |
   | `totp:setup:<userId>` | `totp:setup:a1b2c3d4-...` | 600s (pending 2FA secret until first code confirmed) |
   | `auth:pending_2fa:<nonce>` | `auth:pending_2fa:6b7c...` | 300s (one-shot nonce → userId during 2FA login leg) |

2. **Always set TTL.** Use `RedisService.setWithExpire()` for all new keys. Keys without TTL risk accumulating indefinitely.
3. **Use `RedisService` abstraction.** Never inject the raw `REDIS_CLIENT` (`ioredis`) directly in modules or services. Always go through `RedisService`.
4. **JSON serialization is automatic.** `RedisService` handles `JSON.stringify`/`JSON.parse`. Pass typed objects, receive typed objects via `get<T>()`.
5. **TTL preservation on update:** When updating a key, `RedisService.update()` preserves the remaining TTL. Do not manually re-set TTL unless intentionally extending it.
6. **New key patterns must be documented** in this table before use.

---

## 3. ⚡ Interactivity — WebSockets & TTS

### 3.1 WebSocket Rules (Socket.IO — Overlay Gateway)

1. **Single namespace per domain.** The overlay system uses `/overlay` namespace. New real-time features MUST create their own namespace — never pollute `/overlay`.
2. **Authentication on connection.** `handleConnection()` validates the `overlay_key` query param against the database. Unauthenticated sockets are disconnected immediately.
3. **Room = overlay_key.** Each streamer joins a room identified by their `overlay_key`. Emit events to rooms, never broadcast to the entire namespace.
4. **Heartbeat pattern.** Clients send `heartbeat_pulse` events. The gateway refreshes the Redis `overlay:<key>` TTL (60s). This is how the system tracks "overlay online" status.
5. **Throttle all WebSocket events.** Use `@Throttle()` decorator on every `@SubscribeMessage()` handler to prevent abuse.
6. **Event naming:** `snake_case` for all events: `new_donation`, `displayed_donation`, `heartbeat_pulse`.
7. **Emit from Queue Processors, not Controllers.** Donation notifications are emitted by `DonationsQueueProcessor` after asynchronous processing — never directly from the HTTP controller.

### 3.2 TTS Pipeline Rules

1. **Pipeline order is fixed:**
   ```
   Webhook → Queue → Verify Payment → AI Clean Message → TTS Generate → Upload R2 → Emit WS
   ```
2. **AI moderation is mandatory.** Every user message MUST pass through `AiContract.cleanMessage()` before TTS generation. Raw messages are stored in `message_raw`, clean messages in `message`.
3. **TTS via Contract.** Speech generation uses `SpeechContract`. The concrete provider (Google TTS) is swappable. Never call the Google API directly from business code.
4. **Audio storage path pattern:** `tts/<username>-<donation_id>.mp3` — deterministic and deduplicated.
5. **Audio URL construction:** `${BUCKET_URL}/${ttsKey}`. The full URL is built in the queue processor, NOT stored in the database (store only the `ttsKey`).
6. **All donation processing is asynchronous.** The HTTP endpoint only creates the donation record and returns the Pix code. The heavy pipeline (payment verification, AI, TTS, WS emit) runs in the BullMQ `donations-queue`.

### 3.3 Queue Rules (BullMQ)

1. **Queue naming:** `kebab-case`: `donations-queue`, `email-queue`.
2. **Job naming:** `kebab-case`: `send-donation`, `send-email`.
3. **Retry policy:** All queues MUST configure retry with exponential backoff:
   ```typescript
   defaultJobOptions: {
     attempts: 3,
     backoff: { type: 'exponential', delay: 5000 },
     removeOnComplete: true,
     removeOnFail: 100,
   }
   ```
4. **Processors extend `WorkerHost`.** Use the `@Processor('queue-name')` decorator pattern.
5. **Errors in processors must be re-thrown.** Log the error, then `throw error` so BullMQ can retry. Never swallow errors silently in a processor.

---

## 4. 🔒 Security & Infrastructure

### 4.1 Environment Variables

1. **All env vars are validated at startup.** The `EnvironmentVariables` class in `common/config/env.validation.ts` uses `class-validator` decorators. The app **will not start** if any required variable is missing or malformed.
2. **Adding a new env var requires:**
   - Adding the property with validators to `EnvironmentVariables`
   - Adding it to `.env` and `.env.example`
   - Documenting it in this section
3. **Access env vars via `ConfigService`.** Never use `process.env` directly in services or controllers. The only exceptions are bootstrap-time code (`main.ts`, `app.module.ts`, `PrismaService`).
4. **Secret format:**
   - `ENCRYPTION_KEY`: 64-char hex (256-bit AES key)
   - `EFI_CERTIFICATE_BASE64`: Base64-encoded PFX certificate
   - `JWT_SECRET`: Arbitrary string

### 4.2 Encryption & Hashing

1. **AES-256-GCM for reversible encryption.** Use `SecurityService.encryptData()` / `decryptData()`. Used for PII like CPF.
2. **SHA-256 + salt for irreversible hashing.** Use `crypto.createHash('sha256').update(value + ENCRYPTION_KEY).digest('hex')` for CPF hash, OTP hash, token hash.
3. **bcrypt (cost 12) for passwords.** Always use `bcrypt.hash(password, 12)` and `bcrypt.compare()`.
4. **Never log or return sensitive data.** No CPF, password hash, encryption key, or API tokens in responses or `console.log`.

### 4.3 Cloudflare R2 (Storage)

1. **Access through `StorageContract`.** Never import `R2Service` or `S3Client` directly in business code.
2. **Bucket name is fixed:** `tipply`. Configured in the `R2Service`.
3. **Use `ConfigService` for R2 credentials:** `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_ENDPOINT_URL`.
4. **File key patterns must be documented:**

   | Pattern | Example |
   |---|---|
   | `tts/<username>-<donation_id>.mp3` | `tts/johndoe-abc123.mp3` |

5. **Public URL construction:** `${BUCKET_URL}/<key>`. The `BUCKET_URL` env var points to the public CDN endpoint.

### 4.4 Payment Gateway (Efi / Pix)

1. **Access through `GatewayContract`.** Never import `EfiService` directly. Modules depend on `GatewayContract`.
2. **OAuth token caching.** `EfiService` caches the access token in memory with 60s safety margin before expiration. Do not change this pattern.
3. **Log all gateway interactions.** Every API call (generate Pix, check status) MUST create a `GatewayResponse` record via `GatewayResponseRepository`. This is the audit trail.
4. **Status mapping is centralized** in `EfiService.getPixStatus()`. If Efi adds new statuses, update the `switch` block there — never map statuses in business services.
5. **mTLS certificate** is loaded from `EFI_CERTIFICATE_BASE64` at service initialization. The `https.Agent` is reused across requests.

### 4.5 Authentication & Authorization

1. **Global `AuthGuard`** is registered via `APP_GUARD`. All routes are protected by default.
2. **Public routes** use the `@Public()` decorator (`IS_PUBLIC_KEY` metadata). Use sparingly and document why the route is public.
3. **JWT payload:** `{ sub: userId }`. Do not add extra claims unless strictly necessary.
4. **Token expiration:** 7 days. Configured in `AuthModule`.
5. **Rate limiting is mandatory.** Every public endpoint MUST have a `@Throttle()` override with appropriate limits. Use named throttlers for domain-specific limits (`burst`, `registration_limit`, `donation_create`, etc.).
6. **Auto-reactivation on login.** `AuthService.login` reactivates an inactive account automatically when valid credentials are supplied, while preserving the "Usuário não existe" ambiguity for truly non-existent emails.
7. **2FA login flow.** When `user.totpEnabled` is true, `login` returns `{ requires2fa: true, nonce }` instead of a JWT. The second leg is `POST /auth/login-2fa` with `{ email, password, totp, nonce }`, which re-validates credentials (defends against stolen nonce) and exchanges the one-shot nonce for a session JWT.

---

## 5. 🚫 Output Restrictions — AI Code Generation Rules

### 5.1 Exception Handling — The #1 Rule

**NEVER generate code that catches and handles exceptions with custom response formatting.**

The project uses a global pipeline:
- `GlobalExceptionFilter` catches ALL exceptions globally
- `ResponseInterceptor` wraps ALL successful responses

The standard response envelope is:

```typescript
// ✅ Success (handled by ResponseInterceptor)
{
  success: true,
  data: { ... },
  timestamp: "2026-03-30T21:50:00.000Z",
  path: "/endpoint"
}

// ✅ Error (handled by GlobalExceptionFilter)
{
  success: false,
  error: {
    message: "Human-readable error message",
    code: 400
  },
  timestamp: "2026-03-30T21:50:00.000Z",
  path: "/endpoint"
}
```

**Therefore:**

```typescript
// ✅ CORRECT — Throw NestJS HttpException subclasses. The filter handles the rest.
throw new BadRequestException('Invalid donation amount');
throw new NotFoundException('User not found');
throw new UnauthorizedException('Invalid credentials');
throw new ConflictException('Email already in use');

// ❌ FORBIDDEN — Never manually construct error responses
res.status(400).json({ error: 'something' });

// ❌ FORBIDDEN — Never catch exceptions to reformat them
try { ... } catch (e) { return { success: false, message: e.message }; }

// ❌ FORBIDDEN — Never create custom exception filters per controller/module
@UseFilters(new CustomFilter())
```

### 5.2 Code Generation Prohibitions

| Rule | Why |
|---|---|
| Do NOT use `res.json()` or `res.status()` in controllers | `ResponseInterceptor` handles all response wrapping |
| Do NOT create custom `ExceptionFilter` classes | `GlobalExceptionFilter` is the single point of error handling |
| Do NOT call `PrismaService` outside repositories | Breaks persistence layer isolation |
| Do NOT import concrete providers in module-layer code | Use Contracts; modules depend on abstractions |
| Do NOT use `process.env` in services | Use `ConfigService` injected via DI |
| Do NOT emit WebSocket events from controllers | Use queue processors for async real-time events |
| Do NOT create Redis keys without TTL | Risk of unbounded memory growth |
| Do NOT hardcode Redis key patterns | Follow the documented `prefix:identifier` convention |
| Do NOT skip the AI moderation step for messages | All user messages pass through `AiContract.cleanMessage()` |
| Do NOT store full URLs in the database | Store only the key/path; construct URLs at runtime |

### 5.3 DTO Validation Requirements

1. **All input DTOs** must use `class-validator` decorators (`@IsString`, `@IsNotEmpty`, `@IsNumber`, etc.).
2. **DTOs are validated globally** via `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`. Unknown properties are stripped and rejected.
3. **Never trust raw input.** Even after DTO validation, treat user input as untrusted in the service layer (e.g., re-check existence in DB, sanitize for TTS).

### 5.4 Swagger Documentation

1. **Every controller method** must have `@ApiOperation()` and at least one `@ApiResponse()` decorator.
2. **Document error codes:** 400, 401, 404, 429 where applicable.
3. **Swagger is disabled in production.** The setup is gated behind `NODE_ENV !== 'production'`.

---

## 6. ✅ Quick Reference Checklist

Before submitting any code, verify:

- [ ] Controllers have zero business logic
- [ ] All DB operations go through Repositories
- [ ] Financial mutations use `$transaction`
- [ ] External integrations use abstract Contracts
- [ ] Errors are thrown as `HttpException` subclasses (never custom responses)
- [ ] New env vars are added to `EnvironmentVariables` class
- [ ] Redis keys have TTL and follow naming convention
- [ ] WebSocket events are `snake_case` and throttled
- [ ] Input DTOs have `class-validator` decorators
- [ ] Swagger decorators are present on controller methods
- [ ] No `process.env` usage outside bootstrap code
- [ ] No `console.log` with sensitive data
