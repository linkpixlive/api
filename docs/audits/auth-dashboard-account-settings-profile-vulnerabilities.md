# Avaliação de Segurança — Módulos Auth, Dashboard, Account-Settings e Profile

> Escopo: `src/modules/auth/*`, `src/modules/dashboard/*`, `src/modules/account-settings/*`, `src/modules/profile/*`, `src/common/guards/roles.guard.ts`, `src/common/security/security.service.ts`, `src/main.ts`, `src/app.module.ts`, `prisma/schema.prisma` (model `User`)
> Data: 2026-09-02

## Ranking por Gravidade

| # | Severidade | Vulnerabilidade |
|---|------------|-----------------|
| 1 | 🔴 CRÍTICA | Reset de senha não revoga sessões ativas |
| 2 | 🟠 ALTA | Enumeração de usuário no login + timing oracle |
| 3 | 🟠 ALTA | 2FA desativável apenas com senha (downgrade) |
| 4 | 🟡 MÉDIA | Enumeração via register/forgot-password + vazamento `sendEmail` |
| 5 | 🟡 MÉDIA | Janela de brute-force em TOTP (`login2fa`/`enable2fa`) |
| 6 | 🟡 MÉDIA | Sobrescrita de conta pendente não verificada no `register` |
| 7 | 🟡 MÉDIA | DoS por paginação ilimitada em `GET /dashboard/history` |
| 8 | 🟡 MÉDIA | CORS `origin: '*'` |
| 9 | 🟢 BAIXA | Throttler por IP sem estratégia `trust proxy` |
| 10 | 🟢 BAIXA | Claim `roles` no JWT não utilizado / stale |
| 11 | 🟢 BAIXA | `AuthGuard` sem binding `sid/sub` e sem checar `active` |
| 12 | 🟢 BAIXA | Inconsistência de validação de username |
| 13 | 🟢 BAIXA | `JWT_SECRET` sem tamanho mínimo + comparação OTP sem `timingSafeEqual` |
| 14 | 🟢 BAIXA | TTL 2 min + typo `forgot-passowrd` + `cpf` exposto em `SafeUser` |

---

### 1. 🔴 CRÍTICA — Reset de senha não revoga sessões ativas
- **Arquivos:** `src/modules/auth/auth.service.ts:201-228` + `src/modules/account-settings/account-settings.service.ts:77-98`
- `resetPassword` altera `password` mas não mata sessões Redis `auth:session:<sid>`; inconsistente com `changePassword` que chama `killAllSessionsExceptCurrent`. Sessão roubada permanece válida após recuperação de conta.

### 2. 🟠 ALTA — Enumeração de usuário no login + timing oracle
- **Arquivo:** `src/modules/auth/auth.service.ts:102-107`
- `login` lança `'Usuário não existe.'` vs `'Credenciais inválidas.'`; `bcrypt.compare` é pulado quando usuário não existe → diferença de mensagem + tempo de resposta revela e-mails cadastrados.

### 3. 🟠 ALTA — 2FA desativável apenas com senha
- **Arquivo:** `src/modules/account-settings/account-settings.service.ts:161-174`
- `disable2fa` exige só `password`, sem código TOTP. Phishing/keylogger remove silenciosamente o segundo fator.

### 4. 🟡 MÉDIA — Enumeração via register/forgot-password
- **Arquivos:** `src/modules/auth/auth.service.ts:59-87,168-199`
- `register` retorna mensagens distintas (`Nome de usuário já está em uso`, `CPF já está em uso`, `Email já está em uso`, `Este email já está pendente de verificação`) → oráculo de CPF/username/email. `forgotPassword` retorna `string` quando não existe vs `{ responseMsg, sendEmail }` quando existe → diferença de shape + vazamento de metadados internos.

### 5. 🟡 MÉDIA — Janela de brute-force em TOTP
- **Arquivos:** `src/modules/auth/auth.service.ts:133-166` + `src/modules/account-settings/account-settings.service.ts:133-159`
- Falha de TOTP em `login2fa`/`enable2fa` não consome `nonce` (`auth:pending_2fa`) nem conta tentativas; apenas throttle por IP (10/5min e 5/5min) protege keyspace de 10⁶ por 300s/600s. Rotação de IP amplia janela.

### 6. 🟡 MÉDIA — Sobrescrita de conta pendente no register
- **Arquivo:** `src/modules/auth/auth.service.ts:80-88`
- Re-registrar e-mail não verificado faz `update` de `name/username/cpf/password` da linha pendente (janela de 15 min até `AuthCleanupService` deletar). Permite pre-hijack/griefing de contas pendentes.

### 7. 🟡 MÉDIA — DoS por paginação ilimitada no dashboard
- **Arquivo:** `src/modules/dashboard/dashboard.controller.ts:45-51`
- `GET /dashboard/history?page=&limit=` usa `ParseIntPipe` sem `@Min/@Max`; `limit=1000000` vai direto ao Prisma → exaustão de memória/CPU. `page` negativo gera 500.

### 8. 🟡 MÉDIA — CORS wildcard
- **Arquivo:** `src/main.ts:16`
- `enableCors({ origin: '*' })` com autenticação Bearer; qualquer origem pode fazer chamadas autenticadas se token vazar.

### 9. 🟢 BAIXA — Throttler sem `trust proxy`
- **Arquivo:** `src/app.module.ts:42-96`
- Limites por IP usam IP do socket sem `app.set('trust proxy')`; atrás de nginx/LB todo tráfego compartilha um IP (lockout global) ou, se habilitado incorretamente, `X-Forwarded-For` spoofável bypassa `login_limit`/`recovery_limit`.

### 10. 🟢 BAIXA — Claim `roles` no JWT não utilizado
- **Arquivo:** `src/modules/auth/auth.service.ts:310-314`
- JWT assina `roles`, mas `AuthGuard` recarrega `user.roles` do banco e `RolesGuard` autoriza via `request['user']` — claim morto, stale e viola `RULES.md §4.5.3`.

### 11. 🟢 BAIXA — AuthGuard sem binding sid/sub
- **Arquivo:** `src/modules/auth/auth.guard.ts:47-70`
- Guarda não verifica `session === payload.sub` nem `user.active`; defesa em profundidade ausente (desativação já mata sessões, mas admin-deactivate ficaria exposto).

### 12. 🟢 BAIXA — Inconsistência de validação de username
- **Arquivos:** `src/modules/auth/dto/register-auth.dto.ts:26-32` + `src/modules/profile/dto/update-username.dto.ts:1-9`
- `register` exige `^[a-zA-Z0-9_]+$`, `changeUsername` aceita qualquer string com `@MinLength/@MaxLength` → whitespace/caracteres especiais em URLs de overlay.

### 13. 🟢 BAIXA — JWT_SECRET e comparação OTP
- **Arquivos:** `src/common/config/env.validation.ts:41-42` + `src/modules/auth/auth.service.ts:247`
- `JWT_SECRET` validado só como `IsNotEmpty` (sem tamanho mínimo). Comparação `otpData.otp !== hashedOtp` sem `timingSafeEqual`.

### 14. 🟢 BAIXA — TTL curto, typo e exposição de CPF
- **Arquivos:** `src/modules/auth/auth.service.ts:181-194` + `src/modules/auth/entities/safe-user.entity.ts:29` + `src/common/security/security.service.ts:13,45`
- Reset token expira em 2 min e link usa `forgot-passowrd` (typo). `SafeUser.cpf` (cifrado) está `@Expose` — hoje nenhum endpoint serializa `SafeUser` direto, mas `ClassSerializerInterceptor` global o exporia se um dia retornar.
