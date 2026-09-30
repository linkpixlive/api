# Plano: separar SafeUser público de usuário autenticado interno

**Data:** 2026-09-30
**Status:** proposto (não implementado)
**Área:** `src/modules/auth`, `src/modules/account`, `src/common/{decorators,guards,security}`, `src/infra/db/repositories`, `docs/`

## Problema

`SafeUser` (`src/modules/auth/entities/safe-user.entity.ts:7-92`) acumula dois papéis:

1. **Tipo interno do guard** — `AuthService.validateSessionToken` (`auth.service.ts:335`) monta via `fromPrisma` com `password`, `cpf` (cifrado) e `totpSecret` (cifrado), e o `AuthGuard` (`auth.guard.ts:38`) pendura em `request['user']` para todos os endpoints autenticados.
2. **Tipo público do fio** — `GET /auth/me` (`auth.controller.ts:214-218`, único `@ApiResponse({ type: SafeUser })`) retorna o objeto direto, e o Swagger gera o schema que o frontend consome (`api-schema.d.ts:939-977`, `auth.server.ts:24-27`).

O `ClassSerializerInterceptor` global filtra os segredos no JSON hoje (`@Exclude()` na classe, sem `@Expose()` no `cpf`), mas o contrato já vaza: o schema do Swagger contém `password`, `totpSecret` e `cpf`, e qualquer `return user`, log ou `JSON.stringify` fora do interceptor vaza hash + CPF + TOTP. Consumidores reais de segredo via `request['user']` são só o step-up (`step-up.util.ts:18-28`) chamado por `account.service.ts` (`changeEmail`, `changePassword`, `deactivateAccount`, `disable2fa`) e `withdrawals.service.ts:38`; todo o resto usa só `user.id` (wallets, pix-keys, profile, widgets, donations, dashboard) ou `user.roles` (`roles.guard.ts:36-41`).

## Decisão: dois tipos, não um

Sim, faz sentido ter 2 tipagens — com fronteira explícita:

- **`AuthenticatedUser`** (interno, backend-only): interface TS pura em `src/modules/auth/types/authenticated-user.ts`, **sem** `@Expose/@Exclude/@ApiProperty`, **nunca** citada em `@ApiResponse/@ApiBody`. O Swagger só gera schema para classes referenciadas em decorators — interface nunca citada nunca entra em `api-schema.d.ts`, logo nunca chega ao frontend.
- **`SafeUser`** (público, vai ao fio): mantém o nome para diff mínimo no frontend; vira entity só com campos seguros + `@Expose()`. Único uso em Swagger: `GET /auth/me`.

Sem cache Redis neste plano (ver plano de cache `docs/plans/2026-09-02-auth-guard-user-cache.md`). O ganho aqui é segurança + contrato, não perf. Cache continua fora de escopo até o `select` enxuto provar gargalo.

## Mudanças

### 1. Novo `src/modules/auth/types/authenticated-user.ts`

```ts
// NUNCA referenciar em @ApiResponse/@ApiBody — tipo interno, não gera Swagger.
import type { UserRole } from '@prisma/client';
export interface AuthenticatedUser {
  id: string; email: string; username: string;
  roles: UserRole[]; active: boolean;
  verifiedEmail: boolean; totpEnabled: boolean;
}
```

Sem `password`, `cpf`, `totpSecret`. Step-up passa a re-buscar o usuário completo (item 5).

### 2. `src/modules/auth/entities/safe-user.entity.ts` (público)

- Remover campos `password`, `cpf`, `totpSecret` e o `@ApiProperty` residual do `cpf`.
- `fromPrisma` aceita o shape do `findByIdForAuth` (item 3); adicionar `fromAuthenticatedUser(u: AuthenticatedUser & { name; profileImageUrl; createdAt; usernameChangedAt })` com `getStorageUrl`.
- Header no arquivo: `// Tipo PÚBLICO — aparece no Swagger e no frontend. Não adicionar segredos.`

### 3. `src/infra/db/repositories/users.repositories.ts`

- Novo `findByIdForAuth(id)` com `select` enxuto: `id, name, email, username, profileImageUrl, createdAt, active, verifiedEmail, usernameChangedAt, roles, totpEnabled`. Sem `password`, `cpf`, `cpfHash`, `totpSecret`.
- `findById` permanece intacto para login/login-2fa e step-up.

### 4. `src/modules/auth/auth.service.ts` + `auth.guard.ts` + `current-user.decorator.ts` + `roles.guard.ts`

- `validateSessionToken` usa `findByIdForAuth` e retorna `{ user: AuthenticatedUser, sid }`.
- Guard, `@CurrentUser()` e `RolesGuard` tipam `AuthenticatedUser`. Checar `dashboard.gateway.ts` (usa `validateSessionToken` no handshake — só precisa de `user.id`).

### 5. `src/modules/account/account.service.ts` + `step-up.util.ts`

- `getSettings` / `AccountEntity.fromSafeUser` passam a receber `AuthenticatedUser` (só precisam de `id, email, totpEnabled, active, usernameChangedAt, verifiedEmail`).
- `changeEmail`, `changePassword`, `deactivateAccount`, `disable2fa` re-buscam `usersRepository.findById(user.id)` e fazem `assertPassword/assertTotp` contra o hash fresco (corrige staleness de comparar contra snapshot do guard).
- `StepUpUser` em `step-up.util.ts` vira `Pick<User, 'password' | 'totpEnabled' | 'totpSecret'>` do Prisma, não `SafeUser`.
- `setup2fa` inalterado (só usa `totpEnabled/username/id`).
- `withdrawals.service.ts:create` idem: re-busca para o step-up ou recebe credenciais já validadas (ver build).

### 6. Demais assinaturas `user: SafeUser` → `user: AuthenticatedUser`

`wallets`, `pix-keys`, `withdrawals.findAll`, `profile`, `widgets`, `overlay`, `donations`, `donation-settings`, `dashboard`, `account.controller`, `auth.controller logout/logoutAll`. O build aponta todos (~15 arquivos, troca mecânica — a maioria só usa `user.id`).

### 7. `src/modules/auth/auth.controller.ts`

- `GET /auth/me` mantém `@ApiResponse({ type: SafeUser })`, mas o handler mapeia: `me(u: AuthenticatedUser)` → busca campos de exibição (`findByIdForAuth`) → `SafeUser.fromAuthenticatedUser`. Único ponto que converte interno→público.

### 8. Frontend (contrato)

- Regenerar `api-schema.d.ts`; `auth.server.ts` continua `components["schemas"]["SafeUser"]` — agora sem `password/cpf/totpSecret`. Conferir `LayoutUser` (`ProfilePopover.tsx:9-16`) sem mudança.
- `email` permanece no `SafeUser` nesta etapa (frontend exibe em `ProfileMenuContent` e fallback do `IdentityCard`). Remoção/mascaramento de email é etapa 2 com mudança de UX.

### 9. Documentação anti-regressão

- `docs/architecture.md` (seção Entities): regra nova — "Entity com `@Expose` gera Swagger e vai ao frontend. Tipo interno = interface TS pura em `modules/<m>/types/`, sem decoradores, nunca em `@ApiResponse`. Segredo nunca entra em entity."
- `docs/security.md` (Dados sensíveis): nota — "`request['user']` é `AuthenticatedUser` sem segredos; step-up sempre re-busca via `findById`."
- Header comments nos dois arquivos-fonte (itens 1–2) como barreira de leitura.

## Fora de escopo

- Cache `auth:user:<id>` (plano de 2026-09-02) — reavaliar só com p95 do guard provando gargalo após o `select` enxuto.
- Remoção de `email` do `/auth/me` — exige trocar exibição de email no frontend por `/account/settings` (mascarado) ou remover a exibição.
- `dashboard.gateway.ts:32` (`jwtService.decode` sem verificar assinatura) — issue separada já mapeada.

## Verificação

- `pnpm build` + `pnpm lint` (não há suíte de testes). O build deve quebrar exatamente nos consumidores de `user.password/.totpSecret/.cpf` (item 5 + `step-up.util.ts`).
- Contrato: gerar Swagger e conferir `rg "password|totpSecret|\"cpf\"" swagger.json` → zero matches em `SafeUser`; `rg "AuthenticatedUser" src --glob '*controller.ts'` → zero (interno nunca em controller/Swagger).
- Smoke: login → `GET /auth/me` retorna sem `password/cpf/totpSecret`; `GET /account/settings` com email mascarado; step-up (troca de senha, saque) continua pedindo senha+TOTP.
