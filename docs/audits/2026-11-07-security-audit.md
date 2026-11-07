# Security Audit Report — tipply-backend (LinkPix API)

**Run:** run-1 · 2026-11-07 · skill `security-audit` (full audit mode)
**Source ref:** `main @ 5300dc5` (2026-11-05), worktree dirty — modified `overlay.service.ts`, `donations-queue.processor.ts`, `eslint.config.mjs`, `package.json`, `AGENTS.md`, `docs/architecture.md`; untracked specs/utils reviewed as part of the audited worktree.
**Profile:** `standard` · **Scope:** whole repository (full run, nothing out of scope) · **Prior runs:** none (first run; all units seeded `prior_status: none`).
**Execution policy:** `sandboxed-source-and-local-only` — this Windows host provides no OS-enforced sandbox (no network isolation, empty-environment control, or resource limits for target-controlled processes), so **no target code was executed**. Every check in the ledger is `method: "source"`, `artifact: null`. Consequently, no candidate could reach a locally observed result, and no record carries severity: all surviving candidates are `needs_validation`, not confirmed findings.
**Budget:** 56 agent invocations (revised from the planned 50 — see `run-metadata.json` `budget_revision_note`). **Agents spent: 52** (recon 4, hunters 14, coverage critics 3, Phase-3 verifiers 16, Phase-5 verifiers 15).

## 1. Result

**Zero confirmed vulnerabilities.** This is a genuine result, not a gap: 64 deterministic coverage units were all closed with owned source checks across every HTTP controller, both Socket.IO gateways, both queue pipelines, all four crons, the Efí gateway client, storage, Redis, crypto, the global pipeline, CI/Docker and env handling. The strong controls the code enforces (below) held under adversarial review at every boundary.

**15 leads remain `needs_validation`** (Section 4). Each is a source-grounded boundary hypothesis whose decisive fact requires either executing the target (blocked by this run's sandbox-free host) or observing a deployment/provider fact (proxy topology, R2 policy, Efí/Pix protocol semantics, Gemini behavior, Node runtime flags, overlay frontend rendering). They are prioritized leads with exact local and owner-observed validation plans — not confirmed findings and not severities.

## 2. Security posture summary

The codebase is unusually disciplined for its size. Money correctness rests on a single audited primitive (`applyOp`: `SELECT ... FOR UPDATE` + balance derived from the ledger chain, `wallets.repositories.ts:100-151`) with conditional status-guarded transitions and DB-level `@@unique([withdrawalId, type])` / `Transaction.donationId @unique` backstops — double-credit, double-refund and double-spend were unreachable from every traced path (webhook, cron, admin, queue-retry). Webhook-supplied values can only enqueue re-verification; every money effect requires Efí's own answer. Input validation is uniform (global whitelist+forbidNonWhitelisted pipe), every user-owned read/write is bound to the AuthGuard-derived principal (no trusted client-supplied owner ids found anywhere), secrets use AES-256-GCM with random IVs and fail-closed decryption, OTPs/reset tokens are CSPRNG + hashed + single-use with timing-safe compares, and CI keeps secrets away from PR-triggered jobs. The residual risks concentrate exactly where source alone cannot decide: deployment topology, provider semantics, runtime behavior, and the out-of-repo browser clients.

## 3. Confirmed findings

None. (One candidate was rejected during validation: `donation.min-audio-amount-not-enforced-server-side` — the absence of a server-side `minAudioAmount` check is documented approved product behavior in `docs/plans/2026-09-05-public-donation-flow-endpoints.md:19` and the prior unconditional enforcement was itself audited as a bug in `docs/audits/donations-widgets-vulnerabilities.md`. Retained in `findings.json` under `rejected` so future runs don't repeat the claim.)

## 4. NEEDS VALIDATION (prioritized leads — no severity)

Full records: `findings.json` · details: `NEEDS-VALIDATION.md`. Suggested triage order (impact potential, not severity):

| # | Fingerprint | Boundary / lead | Exact blocker |
|---|---|---|---|
| 1 | `auth.verify-otp-no-registrant-credential-attestation` | Public registration → account pre-takeover of a victim's email (attacker-planted credentials activated by the victim's OTP) | Two-client end-to-end run requires execution; real-victim behavior is a runtime fact |
| 2 | `admin-withdrawal-approve-no-rollback-on-sendpix-failure` | Admin approve → withdrawal wedged in `processing` forever when sendPix fails without an Efí record; funds stay reserved | Efí behavior for unregistered `envio` ids; sandbox run of the wedge |
| 3 | `session-kill.smembers-delete-race-vs-login` | Non-atomic session invalidation → attacker login with old password survives password rotation | Concurrent two-client race requires execution |
| 4 | `account.deactivate.password-only-step-up` | 2FA-enabled account deactivated with password only (siblings all require TOTP) | Two-request comparison requires execution |
| 5 | `auth.totp-attempts-keyed-by-nonce-not-account` | login-2fa attempt counter keyed by re-mintable nonce → unbounded online TOTP guessing with valid password | Edge/WAF throttling + IP-diversity behavior outside repo |
| 6 | `auth-cleanup.deleteManyUnverified.ignores-verified-flag` | Cleanup cron hard-deletes admin-`verified` accounts whose email is unverified (cascade destroys wallet/widgets/tokens) | Postgres fixture run; owner query on production data |
| 7 | `ws-gateway-connection-unhandled-rejection` | WS connect/disconnect infra errors become unhandled rejections → shared API process exit | Deployed Node flags/supervisor; sandbox crash demo |
| 8 | `donor.remote-content-tags-survive-filterxss` | Donor `<audio src=https autoplay>`-style tags survive filterXSS to overlay/dashboard payloads | Overlay/dashboard frontend rendering mode (innerHTML vs text) — out-of-repo |
| 9 | `moderation.prompt-injection-fail-open` | Donor text unframed in Gemini prompt + every failure path fails open → streamer's AI moderation bypassable | Model execution/provider quota behavior outside repo |
| 10 | `efi-getPixStatus-paidAmount-uses-valor-original` | Amount-equality guard compares Efí's charge-configured `valor.original` to itself (vacuous by construction); credit skips received-amount check | Pix/Efí settlement-below-original reachability; cob response shape |
| 11 | `req.ip-tracker-without-proxy-client-ip-resolution` | No trust proxy/throttler tracker override → per-IP throttle buckets (and donor audit IPs) collapse behind the deployment proxy | Render proxy hop count; `donation.ip` row inspection |
| 12 | `overlay-ws-unbounded-message-connection-work` | No throttle/guards reach WS handlers; per-event DB/Redis/R2 amplification against shared pools | Edge connection/message caps; sandboxed amplification measurement |
| 13 | `profile-photo-sharp-decode-amplification` | `sharp` pipeline without `limitInputPixels`; ~268 Mpx decode ceiling (≈1 GB RGBA worst case) at 10 uploads/min | libvips memory behavior; container limits; sandboxed fixture |
| 14 | `overlay-offline-refcount-donation-drop` | Any single overlay disconnect marks the widget offline (no refcount) and paid donations arriving before next heartbeat are silently dropped from alerts | Two-socket sandbox demo; frontend heartbeat cadence (out-of-repo) |
| 15 | `dashboard-gateway.stale-socket-after-session-revocation` | Dashboard WS auth validated only at connect; revoked sessions keep receiving the donor feed | Live socket demo; owner reproduction |

## 5. Hardening notes (selected; complete list in `tools/hardening.json`, ~80 items)

Highest-value hardening (defense-in-depth with no reachable boundary violation — these are not findings):

- **Webhook DTO**: the untyped webhook body bypasses the global ValidationPipe (`webhooks.controller.ts:58`); a small DTO restores the documented boundary cheaply. Also guard `Buffer.from(hmac)` against object-shaped qs values and add `@MinLength` to `EFI_WEBHOOK_SECRET`.
- **Session hygiene**: `disable2fa` doesn't rotate sessions (account.service.ts:228-244); step-up TOTP has no per-account attempt counter (step-up.util.ts:20-35); no consumed-TOTP cache (one code reusable within its 30s step).
- **Crypto hygiene**: `hashData` = sha256(value‖key) rather than HMAC, and reuses the AES key without domain separation (crypto.util.ts:56-60); `decryptPixValue` catch-continues returning ciphertext as the entity `key` (withdrawals.service.ts:219-228, admin-withdrawals.service.ts:87-96); masked pix-key endpoint leaks the ciphertext blob in `key` (pix-keys.service.ts:77-80).
- **Read-time sanitization parity**: donor `name` isn't re-filtered at read paths (donations.service.ts:199; history/overlay/dashboard entities emit name raw) — defense rests solely on create-time filtering; a text-only filterXSS whitelist for donor fields would also strip remote-content tags (see lead 8).
- **Env/ops**: `NODE_ENV=development` silently disables all throttling and (non-prod) exposes Swagger — cross-check against production markers; guard `prisma/seed.ts` against production DB (hardcoded `admin@linkpix.com`/`123456`); validate `JWT_EXPIRES_IN_DAYS` as integer; `PIX_REDIRECT_DESTINATION` needs a production-mode boot guard + audit trail; CI: add `permissions: contents: read` and SHA-pin third-party actions.
- **Reliability**: no Efí HTTP timeout (hung upstream stalls worker/crons/admin approve); scheduler retries a wedged `processing` withdrawal forever with no admin force-fail; no queue `removeOnComplete`/`removeOnFail` retention (unbounded Redis cardinality); 48h hard expiry doesn't consult Efí.

**Positive patterns worth keeping:** `applyOp` ledger-chain derivation under row lock; conditional status-guarded `updateMany` transitions everywhere; `@@unique` DB backstops for idempotency and at-most-once refunds; dummy-hash timing equalization on login; hashed single-use reset tokens with atomic `DELETE ... RETURNING` consumption; Redis Lua compare-and-delete and INCR+EXPIRE primitives; owner-scoped queries at the repository layer on every surface; `@Exclude`-by-default response entities; secrets excluded from CI PR jobs; `.dockerignore`/`.gitignore` discipline (no secret material ever committed — verified via history sweep).

## 6. Coverage summary (ledger)

- **64 units**: 47 `covered`, 17 `candidate` (each carrying ≥1 of the 16 fingerprints), 0 `blocked`, 0 `deferred`, 0 `out_of_scope`.
- **Fingerprints**: 16 total → 15 `needs_validation` (verified in Phase 5), 1 `rejected`.
- **Validation pipeline**: 16/16 Phase-3 independent verifiers completed; 15/15 Phase-5 final record verifications completed (14 `verified`, 1 non-material replacement applied: `overlay-offline-refcount-donation-drop` — corrections were `attempts:4` set at enqueue and a third online-key writer via token rotation; verdict/root cause unchanged).
- **Critics**: post-wave-1, post-wave-2, and a distinct final-clean critic — all returned `stop=true` with no accepted `missing_units`/`reassign_ids`. Hunter-uncovered leads (webhook batch isolation, decrypt display fallback, CPF register oracle) were rejected with source-backed duplication justifications recorded in the critic results. The final-clean critic independently rebuilt the entry-surface inventory from source (16 controllers ~60 routes, 2 gateways, 2 queue pairs, 4 crons) and confirmed every item is inside at least one unit's `reviewed_paths`.
- **Exclusions** (companion files, documented in `run-metadata.json`): CLIENT-SIDE (no client code), MEMORY-SAFETY-AND-BINARY (no native code), DESKTOP-MOBILE-AND-LOCAL-IPC (no such surface). Per-block exclusions with source-grounded reasons are listed in each hunter assignment file.
- **Limits of this pass**: evidence is source-only; the 15 leads above are exactly the places where a sandboxed local run or an owner-observed deployment check would settle the question. A future run with execution capability should start with `NEEDS-VALIDATION.md`.
