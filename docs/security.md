# Segurança

> Verificado contra o código em 2026-09-05.

## Variáveis de ambiente

- Validadas em `common/config/env.validation.ts` (class-validator) — o app não sobe se faltar/malformado. Lista canônica: `.env.example`.
- Acesso só via `ConfigService`; `process.env` apenas em bootstrap (`main.ts`, `app.module.ts`, PrismaService).
- Variável nova: adicionar em `env.validation.ts` + `.env` + `.env.example`.
- Formatos: `ENCRYPTION_KEY` 64 hex (AES-256); `JWT_SECRET` mínimo 32 caracteres; `EFI_CERTIFICATE_BASE64` base64; `JWT_EXPIRES_IN_DAYS` string numérica; `CORS_ORIGIN` origens separadas por vírgula (vazio = CORS desabilitado).

## Criptografia (`common/utils/crypto.util.ts`)

| Operação | Método | Uso |
|---|---|---|
| Reversível | AES-256-GCM (`encryptData`/`decryptData`, IV 12B + tag 16B) | CPF, chave Pix, segredo TOTP |
| Irreversível | sha256(valor + `ENCRYPTION_KEY`) (`hashData`) | `cpfHash`, unicidade de chave Pix, OTP, token de reset |
| Senha | bcrypt custo 12 | login, troca de senha |

- OTP e token de reset são **hasheados** antes de persistir; segredo TOTP **criptografado** em repouso (DB e Redis).
- `keyMasked` (`common/utils/mask.util.ts`) para exibição: `GET /pix-keys` devolve descriptografado, `GET /pix-keys/masked` só a máscara.

## Auth e sessões

- JWT: payload `{ sub, sid }` (sem claim de roles — autorização lê do banco via `AuthGuard`); secret `JWT_SECRET`; expiração `${JWT_EXPIRES_IN_DAYS}d`. `AuthGuard` global (APP_GUARD): valida o binding `session === payload.sub`, checa `user.active` e recarrega o usuário do banco a cada request.
- **Sessão revogável**: `sid` (uuid) → `auth:session:<sid>` (Redis, TTL = dias do JWT) + set `auth:user_sessions:<userId>`. Logout, troca de email/senha, reset de senha (esqueci minha senha) e desativação matam sessões (troca de senha preserva a atual via `@CurrentSid()`).
- **Reset de senha**: token hasheado, TTL de 15 min, resposta uniforme (não revela existência de cadastro, sem metadados internos); link do e-mail aponta para `/forgot-password`.
- Conta inativa reativa no login com credenciais válidas. Login e register não revelam existência de cadastro: login tem mensagem única "Credenciais inválidas" com bcrypt sempre executado (hash dummy quando o usuário não existe); register responde genericamente para e-mail já existente (reenvia o código apenas se o registro estiver pendente, sem sobrescrever os dados pendentes).
- **2FA**: login devolve `{ requires2fa: true, nonce }` (Redis 300s, one-shot); `POST /auth/login-2fa` revalida credenciais + TOTP (defesa contra nonce roubado). Setup: segredo fica no Redis (`totp:setup`, criptografado) até o primeiro código confirmar; issuer "LinkPix". Desativar 2FA exige senha **e** código TOTP. `login-2fa` e `enable-2fa` contam tentativas (máx. 5) e invalidam o nonce/setup ao exceder. Sem backup codes (decisão de design).
- **OTP de email**: 6 dígitos, hash, 600s, cooldown 60s, comparação com `timingSafeEqual`, ≥5 erros invalidam; cron `auth-cleanup` (30min) apaga contas não verificadas há >15min.
- Decorators `@CurrentUser()` e `@CurrentSid()` para acesso ao request.

## Rate limiting

- `ThrottlerGuard` global (**exceto em `development`**), storage Redis (`ThrottlerStorageRedisService`).
- `forRoot` (`app.module.ts`) define só **tetos globais**, válidos para todas as rotas (contador por rota+IP; limite efetivo de uma rota = mínimo entre os buckets): `default` sem nome (45/min — a base overridável), `burst` (5/s), `long_term` (500/h).
- Regra específica de rota = **override no handler**: `@Throttle({ default: { limit, ttl } })` (mais `burst` quando a rota precisar de rajada própria). Armadilha do v6: o nome citado no decorator **precisa** existir no `forRoot`, senão é no-op silencioso; e não existe opt-in — registrar um nome novo o aplica a todas as rotas (`@SkipThrottle` é a única exceção por rota).
- WebSocket: sem throttling — o guard padrão é HTTP-only; throttle de mensagens exigiria um guard custom.

## Sanitização

- `@SanitizeHTML()` (xss.filterXSS) nos campos do doador (`name`, `message`); mensagem re-sanitizada ao montar o payload do overlay.

## Webhook Efí (`POST /webhook/pix`)

- Auth: query param `?hmac=` comparado a `EFI_WEBHOOK_SECRET` com `timingSafeEqual` (segredo compartilhado estático, **não** HMAC do body — é o formato que a Efí suporta: ela só ecoa a string cadastrada na URL).
- Cadastro na Efí: registrar a URL **base** `https://<api>/webhook?hmac=<segredo>` via `PUT /v2/webhook` — a Efí anexa `/pix` sozinha e chama `POST .../webhook/pix?hmac=<segredo>`. Se cadastrar a URL cheia (`.../webhook/pix?hmac=...`), adicionar `&ignorar=` ao fim para não duplicar o `/pix`.
- Segredo em query string pode vazar em logs/proxies — rotação manual; mTLS/IP allowlist como mitigação (follow-up de infra, ver auditorias de withdrawals).
- Batch máximo 5; roteia: `gnExtras.idEnvio` → saque; senão `txid` → doação (só enfileira se ainda `pending`).

## Gateway Efí

- Toda interação gera `GatewayResponse` (auditoria) via `GatewayResponseRepository`.
- Token OAuth cacheado em memória com margem de 60s; mapping de status centralizado em `EfiService.getPixStatus` — nunca mapear status em services.
- Em `development`, o destino do saque é forçado para `efipay@sejaefi.com.br`.

## Dados sensíveis

- Nunca logar ou retornar CPF, hash de senha, chaves ou tokens. `SafeUser` e as entities com `@Exclude` cuidam das respostas (o `cpf` de `SafeUser` não tem `@Expose` — nunca é serializado).
