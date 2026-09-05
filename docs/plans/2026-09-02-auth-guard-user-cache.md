# Plano: cache do usuário autenticado no AuthGuard (cache-aside Redis)

**Data:** 2026-09-02
**Status:** proposto (não implementado)
**Área:** `src/modules/auth`, `src/infra/db/repositories`, `src/infra/redis`

## Problema

O `AuthGuard` global (`src/modules/auth/auth.guard.ts:58`) executa `usersRepository.findById(payload.sub)` em **toda** requisição autenticada. O `findById` é um `findUnique` sem `select` — carrega a linha inteira do usuário (hash de senha, CPF/CPF hash, TOTP secret), que é descartada ao montar o `SafeUser`. O caminho quente de todos os endpoints fica dependente do Postgres:

```
requisição → verify JWT → GET Redis (auth:session:<sid>) → query Postgres (user.findUnique) → SafeUser
```

## Decisão: cache-aside Redis no guard

Trocar a query Postgres por um GET Redis de um snapshot enxuto do usuário, com invalidação explícita no ponto único de escrita + TTL como rede de segurança.

### Alternativas consideradas e rejeitadas

| Alternativa | Por que não |
|---|---|
| **JWT 100% stateless** (claims no token, zero lookup) | Token único de 20 dias, sem refresh/rotação: mudanças de papéis/status só valeriam no relogin. Exigiria redesenhar o ciclo de vida de tokens (escopo muito maior). |
| **Snapshot do usuário dentro da sessão** (`auth:session:<sid>`) | Economizaria 1 GET, mas duplica o usuário por sessão e exige percorrer `auth:user_sessions:<userId>` a cada mutação — ou aceitar staleness de até 20 dias em dados cosméticos (username, avatar). |

### Por que o espaço no Redis não é problema

Entrada de ~0,5–1 KB por usuário (JSON do snapshot enxuto) com TTL de 300s: o espaço escala com usuários **ativos na janela de TTL**, não com o total de contas. 10 mil usuários ativos ≈ ~10 MB pior caso.

### Por que a invalidação não pode ser esquecida

Toda mutação de usuário já passa obrigatoriamente por `UsersRepository.update` ou `UsersRepository.changeUsernameWithBlacklist` (invariante de camadas: Prisma só em repositories). Colocando o `DEL` dentro desses dois métodos, o ponto é único e à prova de drift — os ~9 call sites em `account-settings`, `admin` e `auth` ficam cobertos sem alteração.

## Mudanças

### 1. `src/infra/redis/redis-keys.ts`

- Builder `authUser: (userId) => \`auth:user:${userId}\``.
- `REDIS_TTL.authUser = 300`.

### 2. `src/infra/db/repositories/users.repositories.ts`

- Novo método `findByIdForAuth(id)`: `findUnique` com `select` enxuto — `id, name, email, username, profileImageUrl, createdAt, active, verifiedEmail, usernameChangedAt, roles, totpEnabled`. **Sem** `password`, `cpf`, `cpfHash`, `totpSecret`.
- Injetar `RedisService` e, após `update` e `changeUsernameWithBlacklist` commitarem, `remove(RedisKeys.authUser(userId))` em try/catch silencioso (falha de DEL não deve derrubar a mutação; o TTL limita a janela de staleness a 300s).
- `findById` permanece como está: login, login-2fa e os fluxos sensíveis de account-settings continuam buscando a linha completa quando precisam de segredos.

### 3. `src/modules/auth/entities/safe-user.entity.ts`

- Remover os campos `password`, `cpf` e `totpSecret` de `SafeUser` — nunca são consumidos a partir do guard (`.cpf` não tem nenhum uso; `.password` só é usado em `changeEmail`/`changePassword`/`deactivateAccount`/`disable2fa`, que passam a re-buscar — ver item 5; `.totpSecret` só é usado no login-2fa, que busca o usuário fresco).
- `fromPrisma` passa a aceitar o shape enxuto (tipo derivado do `select` do item 2).
- Novo `SafeUser.fromCache(json)`: reidrata as datas (`createdAt`, `usernameChangedAt`) que o round-trip JSON do Redis devolve como string ISO. Seguro hoje: quem faz aritmética com essas datas (`profile.service.ts:56`, cooldown de username) busca o usuário fresco via `findById`, não usa o `request['user']`.

### 4. `src/modules/auth/auth.guard.ts`

Novo fluxo em `canActivate`:

1. verify JWT (inalterado);
2. GET `auth:session:<sid>` — kill-switch de revogação permanece intacto (logout, troca de email/senha e desativação continuam derrubando sessão na hora);
3. GET `auth:user:<sub>`:
   - **hit** → `SafeUser.fromCache(json)`;
   - **miss** → `findByIdForAuth(sub)` → `SafeUser.fromPrisma` → `setWithExpire(RedisKeys.authUser(sub), REDIS_TTL.authUser, safeUser)`;
4. `!user` em qualquer caminho → 401 (inalterado).

Cache stampede no cold-start é irrelevante (algumas queries concorrentes por usuário na primeira janela de 5 min).

### 5. `src/modules/account-settings/account-settings.service.ts`

`changeEmail` (:56), `changePassword` (:85), `deactivateAccount` (:102) e `disable2fa` (:167) fazem `bcrypt.compare` contra `user.password` vindo do `request['user']`. Com `password` removido do `SafeUser`, o build quebra — re-buscar o usuário completo via `usersRepository.findById(user.id)` dentro desses métodos e comparar contra o hash fresco. São operações raras e sensíveis; a query extra é irrelevante e ainda corrige um stalleness latente (comparar senha contra snapshot do guard).

`setup2fa` usa apenas `totpEnabled`/`username`/`id` do guard — inalterado.

### 6. Documentação

- `docs/data.md`: nova linha na tabela de chaves — `auth:user:<userId>` (snapshot `SafeUser` para o AuthGuard, TTL 300s, invalidação via `UsersRepository.update`/`changeUsernameWithBlacklist`).
- `docs/security.md`: nota de que o guard serve o `SafeUser` do cache Redis e que segredos (password, cpf, totpSecret) **não** são cacheados — alinhado com a regra de não persistir material sensível.

## Fora de escopo (achados durante a análise — sugerir issues separadas)

- `src/infra/websocket/dashboard.gateway.ts:32` usa `jwtService.decode` sem verificar assinatura nem sessão Redis — falha de segurança real (token forjado/malformado bem-formado é aceito).
- Overlay gateway faz `findByToken` no Postgres por mensagem (`alert_finished` → `dispatchIfReady`/`dispatchNextAlert`) — mesmo padrão de cache por token aplicável depois.
- Chaves `auth:session:`/`auth:user_sessions:` são literais inline em `auth.service.ts`/`account-settings.service.ts`, fora da convenção de builders do `redis-keys.ts` — oportunidade de formalização.

## Verificação

- `pnpm build` + `pnpm lint` (não há suíte de testes). O build valida a remoção dos campos sensíveis de `SafeUser` em todos os consumidores (é esperado que quebre exatamente os 4 pontos do item 5).
- Smoke manual: login → duas requisições seguidas → com log de queries do Prisma, a segunda não deve emitir `user.findUnique`.
