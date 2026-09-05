# Design — Account Settings Module

**Date:** 2026-08-04
**Status:** Approved (pending user final review)
**Project:** `tipply-backend` — Tipply Account (User) Configuration Module

---

## 1. Goal

Provide streamers with self-service account management:

- Change account info (display name, email, password)
- Configure two-factor authentication (TOTP — Proton Authenticator, Google Authenticator, etc.)
- Deactivate account with automatic reactivation on login

This module follows the project Clean Architecture rules (Controller → Service → Repository/Contract) and reuses existing infrastructure: Redis sessions, email queue, `SecurityService`, and the global `AuthGuard`.

---

## 2. Scope (v1)

### Included

| Feature | Notes |
|---|---|
| Change display `name` | Direct, no password required |
| Change `email` | Requires password; resets `verifiedEmail=false`; **kills all sessions**; sends fresh OTP to the new address |
| Change `password` | Requires current password; bcrypt cost 12; **keeps current session, kills others** |
| Deactivate account | Requires password; sets `active=false`; kills all sessions |
| Auto-reactivate on login | `AuthService.login` reactivates when valid credentials are supplied for an inactive account |
| TOTP 2FA (basic) | Setup → enable (validate first code) → disable (password). No backup codes |

### Explicitly excluded (YAGNI)

- Backup/recovery codes for 2FA
- QR code image generation on backend — backend returns the `otpauth://` URL and secret; **the frontend renders the QR** (no `qrcode` dependency)
- Dual email verification (old + new email)
- Grace-period → permanent-delete flow
- Account settings history / audit log (beyond standard structured logging)
- Profile picture management (already modeled in `profileImageUrl`, not changed here)

---

## 3. Architecture

### 3.1 Module layout

```
src/modules/account-settings/
├── dto/
│   ├── change-name.dto.ts           # { name }
│   ├── change-email.dto.ts          # { email, password }
│   ├── change-password.dto.ts       # { currentPassword, newPassword }
│   ├── enable-2fa.dto.ts            # { token } — first TOTP code
│   ├── disable-2fa.dto.ts           # { password }
│   └── deactivate-account.dto.ts    # { password }
├── entities/
│   └── account-settings.entity.ts   # response view: email (masked), has2fa, active, usernameChangedAt
├── account-settings.controller.ts
├── account-settings.service.ts
└── account-settings.module.ts
```

The login-2FA challenge stays in the `auth` module (it is part of the authentication pipeline, not account settings). A single new DTO lives there: `src/modules/auth/dto/login-2fa.dto.ts`.

### 3.2 Layer boundaries

- **Controller (`account-settings.controller.ts`)** — thin: DTO validation, delegate to service, return. No business logic, no direct Redis/Prisma calls, no `try/catch`.
- **Service (`account-settings.service.ts`)** — orchestrates `UsersRepository`, `RedisService`, `EmailService`, `SecurityService`, `otplib`. Throws NestJS `HttpException` subclasses. No raw SQL, no `PrismaService`, no vendor SDK exposure.
- **Repository (`infra/db/repositories/users.repositories.ts`)** — extended only; accepts typed DTO params.
- **No new Contract** required: TOTP generation is a pure library concern (not an external service), per Clean Architecture boundary convention we do not need to abstract `otplib` behind a Contract. All *infrastructure* interactions (Redis persistence, SMTP queue, encryption) already flow through the established abstractions.

### 3.3 Dependencies

**New runtime dependency:**

```bash
pnpm add otplib
```

**Reused infra:**
- `SecurityService` — AES-256-GCM encrypt/decrypt of the TOTP secret
- `RedisService` — sessions, pending-2FA nonce, 2FA pending-setup temp key
- `EmailService` — queue-based email send ({ to, subject, templateName, context, metadata })
- `bcryptjs` — password hashing (cost 12)
- `AuthGuard`, `@CurrentUser()`, `@CurrentSid()`, `@Throttle()` decorators

---

## 4. Data model

### 4.1 Prisma — `User` model (additive only)

```prisma
model User {
  // ... existing fields ...
  totpSecret   String? @map("totp_secret") @db.VarChar(500) // AES-256-GCM encrypted TOTP secret
  totpEnabled  Boolean @default(false) @map("totp_enabled")

  @@map("users")
}
```

- `totpSecret` — AES-256-GCM encrypted via `SecurityService.encryptData()`. Never logged or returned via API. Decrypted only inside the service layer, in-memory, just to verify a submitted TOTP.
- `totpEnabled` — gates the 2FA challenge during login.
- Migration via `pnpm db:migrate`.

### 4.2 Repository DTO updates — `infra/db/repositories/dto/users.dto.ts`

```typescript
export interface UpdateUserParams {
  // ... existing fields ...
  totpSecret?: string | null;
  totpEnabled?: boolean;
  active?: boolean;
}
```

No new repository file; `UsersRepository.update()` supports these fields.

---

## 5. Redis keys (new patterns — per AGENTS.md § 2.2)

| Pattern | Example | TTL | Purpose |
|---|---|---|---|
| `totp:setup:<userId>` | `totp:setup:a1b2c3d4-…` | 600 s | Encrypted pending TOTP secret until user confirms first code |
| `auth:pending_2fa:<nonce>` | `auth:pending_2fa:6b7c…` | 300 s | Pre-2FA ticket: maps a random one-shot nonce → `userId` while the user enters the TOTP code |

All keys are set via `RedisService.setWithExpire()`. No permanent keys. These two patterns must be added to the AGENTS.md key table when this module lands.

---

## 6. API endpoints

All endpoints are protected by the global `AuthGuard` (no `@Public()`). Every handler is decorated with `@ApiOperation()` and at least 2 `@ApiResponse()` decorators (Portuguese, matching existing style), and at least one named `@Throttle()`.

| Method | Path | Named throttler | Description |
|---|---|---|---|
| `GET` | `/account-settings` | *default (`standard`)* | Get current account settings (masked email, `has2fa`, `active`, `usernameChangedAt`) |
| `PATCH` | `/account-settings/name` | *default (`standard`)* | Update display name |
| `PATCH` | `/account-settings/email` | `email_change_limit` | Update email; requires `password`; kills all sessions; OTP to new email |
| `PATCH` | `/account-settings/password` | `password_change_limit` | Update password; requires `currentPassword`; **keeps current session**, kills other sessions |
| `PATCH` | `/account-settings/deactivate` | `deactivation_limit` | Soft-delete; requires `password`; sets `active=false`; kills all sessions |
| `POST` | `/account-settings/2fa/setup` | `2fa_limit` | Generate TOTP secret; store encrypted in Redis `totp:setup:<userId>`; return `{ otpauthUrl, secret }` |
| `POST` | `/account-settings/2fa/enable` | `2fa_limit` | Validate first TOTP token; persist encrypted secret; set `totpEnabled=true` |
| `POST` | `/account-settings/2fa/disable` | `2fa_limit` | Validate `password`; clear `totpSecret`; set `totpEnabled=false` |
| `POST` | `/auth/login-2fa` | `login_limit` (reused) | Second-factor leg of login — `{ email, password, totp, nonce }` |

### 6.1 Named throttlers to register in `app.module.ts`

This also fixes the pre-existing gap where `auth.controller.ts` references `login_limit`/`registration_limit`/`recovery_limit` but `ThrottlerModule.forRoot()` currently defines only `burst`/`standard`/`long_term`:

```typescript
{ name: 'burst',                 ttl: 1_000,    limit: 5 },   // existing
{ name: 'standard',              ttl: 60_000,   limit: 45 },  // existing
{ name: 'long_term',             ttl: 3_600_000,limit: 500 }, // existing
{ name: 'login_limit',           ttl: 300_000,  limit: 10 },
{ name: 'registration_limit',    ttl: 900_000,  limit: 3 },
{ name: 'recovery_limit',        ttl: 900_000,  limit: 4 },
{ name: 'email_change_limit',    ttl: 900_000,  limit: 3 },
{ name: 'password_change_limit', ttl: 900_000,  limit: 3 },
{ name: '2fa_limit',             ttl: 300_000,  limit: 5 },
{ name: 'deactivation_limit',    ttl: 900_000,  limit: 3 },
```

---

## 7. Flows

### 7.1 Change name (simplest)

1. `@CurrentUser()` → `userId`, body validated via `ChangeNameDto` (`@IsString() @MaxLength(100) @IsNotEmpty()`).
2. `usersRepository.update(userId, { name })`.
3. Return `{ name }` wrapped by `ResponseInterceptor`.

### 7.2 Change email (direct + password confirmation)

1. DTO `ChangeEmailDto`: `{ email: IsEmail, password: IsString @IsNotEmpty }`.
2. Re-fetch user via `usersRepository.findById(userId)` (do not trust cached `SafeUser` email).
3. `bcrypt.compare(dto.password, user.password)` → `UnauthorizedException('Credenciais inválidas')` on mismatch.
4. `usersRepository.findByEmail(dto.email)` → if found and `found.id !== userId` → `ConflictException('Email já está em uso')`.
5. `usersRepository.update(userId, { email: dto.email, verifiedEmail: false })`.
6. **Kill all sessions**: read Redis set `auth:user_sessions:<userId>`, delete every `auth:session:<sid>` and delete the set key. (Email is the login anchor; every stale token must become invalid immediately.)
7. Extract OTP-sending from `AuthService.sendVerificationOtp()` into a reusable helper (a `sendVerificationOtp(email)` method on a shared small `AccountNotificationsService` **or** simply expose it from `AuthService` and inject `AuthService` — preferred minimal approach: extract OTP sending into a new provider `VerificationService` exported by `AuthModule` and consumed by `AccountSettingsModule` — no circular dependency because `AuthModule` does not import `AccountSettingsModule`).
8. Return `{ message: 'Email atualizado. Verifique o novo endereço.' }`.

### 7.3 Change password (keep current, kill others)

1. DTO `ChangePasswordDto`: `{ currentPassword, newPassword @MinLength(8) with strength validator reuse if exists }`.
2. `bcrypt.compare(dto.currentPassword, user.password)` → `UnauthorizedException` on mismatch.
3. `newHash = await bcrypt.hash(dto.newPassword, 12)`.
4. `usersRepository.update(userId, { password: newHash })`.
5. Read Redis set `auth:user_sessions:<userId>`, delete every `auth:session:<sid>` except the current `@CurrentSid()` `sid`; remove the deleted sids from the set (preserve current sid in the set).
6. Return `{ message: 'Senha alterada com sucesso.' }`.

### 7.4 Deactivate account

1. DTO `DeactivateAccountDto`: `{ password @IsString @IsNotEmpty }`.
2. `bcrypt.compare(...)` → `UnauthorizedException` on mismatch.
3. `usersRepository.update(userId, { active: false })`.
4. Kill all sessions for the user (same Redis dance as 7.2).
5. `Logger.log(\`Account deactivated: userId=...\`)` — no sensitive data.
6. Return `{ message: 'Conta desativada. Faça login para reativar.' }`.

### 7.5 Auto-reactivate on login (edit to `AuthService.login`)

Inside `AuthService.login`, after the password check, replace the current early-return on `!user.active` with:

```typescript
if (!user.active) {
  await this.usersRepository.update(user.id, { active: true });
  this.logger.log(`Account auto-reactivated via login: userId=${user.id}`);
}
```

This preserves the current "Usuário não existe" ambiguity for truly non-existent emails while reactivating valid, previously deactivated accounts automatically.

### 7.6 2FA — setup

`POST /account-settings/2fa/setup`
1. Guard against already-enabled 2FA: read user; if `user.totpEnabled === true` → `BadRequestException('2FA já está ativo')`.
2. Generate `secret = authenticator.generateSecret()` (32-char base32 by default).
3. Encrypt: `encryptedSecret = securityService.encryptData(secret)`.
4. Persist pending: `redis.setWithExpire(\`totp:setup:\${userId}\`, 600, { encryptedSecret })`.
5. Build URL: `otpauthUrl = authenticator.keyuri(user.username, 'Tipply', secret)`.
6. Return `{ otpauthUrl, secret }` — the frontend renders the QR from the URL.

### 7.7 2FA — enable (validate first code)

`POST /account-settings/2fa/enable` with `{ token: string }` (6-digit):
1. Read `pending = redis.get<{ encryptedSecret: string }>(\`totp:setup:\${userId}\`)`. If missing → `BadRequestException('Configuração expirada ou não iniciada. Reinicie o setup.')`.
2. `secret = securityService.decryptData(pending.encryptedSecret)`.
3. `authenticator.verify({ token: dto.token, secret })` → on fail → `BadRequestException('Código inválido')`.
4. `usersRepository.update(userId, { totpSecret: pending.encryptedSecret, totpEnabled: true })` — reuse the already-encrypted string.
5. `redis.remove(\`totp:setup:\${userId}\`)`.
6. `Logger.log('2FA enabled: userId=…')`.
7. Return `{ message: '2FA ativado com sucesso.' }`.

### 7.8 2FA — disable (password)

`POST /account-settings/2fa/disable` with `{ password: string }`:
1. `bcrypt.compare(...)` → `UnauthorizedException` on mismatch.
2. `usersRepository.update(userId, { totpSecret: null, totpEnabled: false })`.
3. Return `{ message: '2FA desativado.' }`.

### 7.9 Login with 2FA (edit to `AuthService.login` + new endpoint)

**In `AuthService.login`, after reactivation check:**

```typescript
if (user.totpEnabled) {
  const nonce = crypto.randomUUID();
  await this.redisService.setWithExpire(`auth:pending_2fa:${nonce}`, 300, user.id);
  return { requires2fa: true, nonce };
}
```

(When `requires2fa` is returned, no session is created yet.)

**New endpoint `POST /auth/login-2fa`** — DTO `Login2faDto`: `{ email: IsEmail, password: IsString, totp: IsString @Length(6,6), nonce: IsUUID }`:
1. Re-validate credentials via `bcrypt.compare` after fetching user by email (defends against a stolen `nonce` being used alone).
2. Read `userId` from Redis `auth:pending_2fa:<nonce>` → if missing/expired → `UnauthorizedException('Sessão expirada. Faça login novamente.')`.
3. Compare resolved `userId` with the user found by email → mismatch: `UnauthorizedException()`.
4. `if (!user.totpEnabled || !user.totpSecret)` → `BadRequestException('2FA não ativo nesta conta')`.
5. `secret = securityService.decryptData(user.totpSecret)`; `authenticator.verify({ token: dto.totp, secret })` → fail: `UnauthorizedException('Código inválido')`.
6. Delete Redis key `auth:pending_2fa:<nonce>` (one-shot).
7. `return this.createSession(user.id, user.roles)` — JWT delivered as usual.

---

## 8. Error handling

- Only NestJS `HttpException` subclasses are thrown: `UnauthorizedException`, `BadRequestException`, `ConflictException`, `NotFoundException`.
- `GlobalExceptionFilter` formats the response; `ResponseInterceptor` wraps success. No `try/catch` for business errors.
- Sensitive operations log security events via `Logger`: account deactivated, auto-reactivated, 2FA enabled/disabled, password changed. **Never log** passwords, TOTP secrets, encrypted blobs, hashed secrets, or CPF.

---

## 9. Testing

- Co-located unit test: `src/modules/account-settings/account-settings.service.spec.ts`.
- Mock `UsersRepository`, `RedisService`, `EmailService`, `SecurityService`.
- Key cases:
  - Change email — wrong password → `UnauthorizedException`.
  - Change email — email in use by another user → `ConflictException`.
  - Change email — success updates `verifiedEmail=false`, kills all sessions, enqueues verification email.
  - Change password — wrong current password → 401; on success, kills all sessions except current.
  - Deactivate — sets `active=false`, kills sessions.
  - 2FA setup — returns `otpauthUrl` + `secret`; writes encrypted pending key to Redis.
  - 2FA enable — bad code → 400; good code sets `totpEnabled=true` and clears Redis pending key.
  - 2FA disable — bad password → 401.
  - Login flow (in `auth.service.spec.ts` — extend or create) — deactivated user is auto-reactivated on valid credentials.
  - Login-2FA — valid nonce + wrong TOTP → 401; missing/expired nonce → 401; mismatching email ↔ nonce userId → 401.
- E2E: skip for v1; the existing `test/app.e2e-spec.ts` pattern can be extended later.

---

## 10. Documentation & AGENTS.md updates

When implemented, update `AGENTS.md`:
- § 2.2 Redis key patterns — add `totp:setup:<userId>` (600 s) and `auth:pending_2fa:<nonce>` (300 s).
- § 4.5 auth notes — document that login auto-reactivates inactive accounts with valid credentials.
- § 6 Quick Reference Checklist — no changes required; adding a module respects every existing rule.

No new env vars are introduced (no changes to `.env`/`.env.example`/`env.validation.ts`).

---

## 11. Out of scope / future

- Backup codes for 2FA (v2).
- Backend-side QR PNG generation (v2).
- Login alerts / email on new session.
- Account settings audit table.
- Admin-side forced reactivation.
- Email blacklist on change (parallel to `UsernameBlacklist`).
- Profile image management.

---

## 12. Deliverables (implementation checklist)

1. Prisma migration adding `totp_secret`, `totp_enabled` to `users`.
2. `pnpm add otplib`.
3. `UpdateUserParams` extended with `totpSecret | totpEnabled | active`.
4. Add named throttlers in `app.module.ts` (also fixing the missing existing ones).
5. New module `src/modules/account-settings/` with 6 DTOs, 1 entity, controller, service, module.
6. Register `AccountSettingsModule` in `app.module.ts`.
7. Extract OTP-sending from `AuthService` → reusable `VerificationService`; `AuthModule` exports it; `AccountSettingsModule` consumes it.
8. Modify `AuthService.login` for auto-reactivation and 2FA check.
9. Add `POST /auth/login-2fa` to `AuthController` (+ DTO).
10. Unit tests for the new service + updated auth tests.
11. Update `AGENTS.md` with the two new Redis key patterns and a note about auto-reactivation.
