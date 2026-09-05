# Segurança

> Verificado contra o código em 2026-09-02.

## Variáveis de ambiente

- Validadas em `common/config/env.validation.ts` (class-validator) — o app não sobe se faltar/malformado. Lista canônica: `.env.example`.
- Acesso só via `ConfigService`; `process.env` apenas em bootstrap (`main.ts`, `app.module.ts`, PrismaService).
- Variável nova: adicionar em `env.validation.ts` + `.env` + `.env.example`.
- Formatos: `ENCRYPTION_KEY` 64 hex (AES-256); `EFI_CERTIFICATE_BASE64` base64; `JWT_EXPIRES_IN_DAYS` string numérica.

## Criptografia (`common/security/security.service.ts`)

| Operação | Método | Uso |
|---|---|---|
| Reversível | AES-256-GCM (`encryptData`/`decryptData`, IV 12B + tag 16B) | CPF, chave Pix, segredo TOTP |
| Irreversível | sha256(valor + `ENCRYPTION_KEY`) (`hashData`) | `cpfHash`, unicidade de chave Pix, OTP, token de reset |
| Senha | bcrypt custo 12 | login, troca de senha |

- OTP e token de reset são **hasheados** antes de persistir; segredo TOTP **criptografado** em repouso (DB e Redis).
- `keyMasked` (`common/utils/mask.util.ts`) para exibição: `GET /pix-keys` devolve descriptografado, `GET /pix-keys/masked` só a máscara.

## Auth e sessões

- JWT: payload `{ sub, sid, roles }`; secret `JWT_SECRET`; expiração `${JWT_EXPIRES_IN_DAYS}d`. `AuthGuard` global (APP_GUARD).
- **Sessão revogável**: `sid` (uuid) → `auth:session:<sid>` (Redis, TTL = dias do JWT) + set `auth:user_sessions:<userId>`. Logout, troca de email/senha e desativação matam sessões (troca de senha preserva a atual via `@CurrentSid()`).
- Conta inativa reativa no login com credenciais válidas; a ambiguidade "Usuário não existe" fica só para email inexistente.
- **2FA**: login devolve `{ requires2fa: true, nonce }` (Redis 300s, one-shot); `POST /auth/login-2fa` revalida credenciais + TOTP (defesa contra nonce roubado). Setup: segredo fica no Redis (`totp:setup`, criptografado) até o primeiro código confirmar; issuer "LinkPix". Sem backup codes (decisão de design).
- **OTP de email**: 6 dígitos, hash, 600s, cooldown 60s, ≥5 erros invalidam; cron `auth-cleanup` (30min) apaga contas não verificadas há >15min.
- Decorators `@CurrentUser()` e `@CurrentSid()` para acesso ao request.

## Rate limiting

- `ThrottlerGuard` global (**exceto em `development`**), storage Redis (`ThrottlerStorageRedisService`).
- 12 throttlers nomeados em `app.module.ts`: `burst` (5/s), `standard` (45/min), `long_term` (500/h), `login_limit`, `registration_limit`, `recovery_limit`, `email_change_limit`, `password_change_limit`, `2fa_limit`, `deactivation_limit`, `ws_alert_finished`, `ws_heartbeat`. Outros usados inline: `donation_create`, `username_lookup`, `webhook_burst`, `webhook_sustained`, `health_check`.
- Endpoint público novo → `@Throttle` explícito com os nomes apropriados.

## Sanitização

- `@SanitizeHTML()` (xss.filterXSS) nos campos do doador (`name`, `message`); mensagem re-sanitizada ao montar o payload do overlay.

## Webhook Efí (`POST /webhook/pix`)

- Auth: query param `?hmac=` comparado a `EFI_WEBHOOK_SECRET` com `timingSafeEqual` (segredo compartilhado, **não** HMAC do body).
- Batch máximo 5; roteia: `gnExtras.idEnvio` → saque; senão `txid` → doação (só enfileira se ainda `pending`).

## Gateway Efí

- Toda interação gera `GatewayResponse` (auditoria) via `GatewayResponseRepository`.
- Token OAuth cacheado em memória com margem de 60s; mapping de status centralizado em `EfiService.getPixStatus` — nunca mapear status em services.
- Em `development`, o destino do saque é forçado para `efipay@sejaefi.com.br`.

## Dados sensíveis

- Nunca logar ou retornar CPF, hash de senha, chaves ou tokens. `SafeUser` e as entities com `@Exclude` cuidam das respostas.
