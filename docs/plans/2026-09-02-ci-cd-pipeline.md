# Plano — Pipeline CI/CD para linkpix-api

**Data:** 2026-09-02 · **Status:** proposto · **Decisões:** CI completo sem deploy automático; produção alvo em PaaS gerenciado

## Contexto

O repo (`linkpixlive/api`) está no GitHub e **não tem nenhum CI configurado**. Não existe suíte de testes: zero `*.spec.ts` em `src/` e o scaffold e2e (`test/app.e2e-spec.ts`) está quebrado — espera uma rota `/` que não existe. A verificação atual do projeto é `pnpm build` + `pnpm lint` (o script `lint` usa `--fix`). A imagem Docker multi-stage já está pronta para produção (`node:24-slim`, non-root, `prisma generate` no build), e o `docker-compose.yml` cobre só a infra de dev (Postgres 17 na porta 5433, Redis 7 na 6380). Detalhe relevante: `pnpm test` hoje **falha** — jest sai com erro "No tests found" (suíte vazia, sem `--passWithNoTests`).

Outros fatos que moldaram o desenho:

- 9 migrations em `prisma/migrations/`; a mais recente (`20260811220000_wallet_balance_ledger_trigger`) contém SQL customizado (trigger de ledger) → em produção é obrigatório `prisma migrate deploy` (`pnpm db:deploy`), nunca `db push`.
- 26 env vars obrigatórias validadas no bootstrap (`src/common/config/env.validation.ts`, `skipMissingProperties: false`) — o app morre antes de subir se faltar qualquer uma. Porém **nenhuma integração externa é contatada no bootstrap** (Efí, Gradium, R2, Resend e Gemini só em runtime) → um smoke test no CI precisa apenas de valores válidos dummy + Postgres + Redis acessíveis.
- `GET /health` é shallow (liveness apenas, sem checar DB/Redis).
- `packageManager: pnpm@11.4.0` com lockfile presente → usar `--frozen-lockfile`. Não há `engines` nem `.nvmrc`; Docker usa node:24, README pede Node 22+.
- `pnpm-workspace.yaml` tem chaves `allowBuilds` pendentes; o Dockerfile contorna com `--dangerously-allow-all-builds`.

## Tese

Mesmo sem suíte de testes, o CI vira uma rede de proteção real ao validar, a cada PR e push na `main`:

1. **Compilação** (`tsc` via `nest build`) e **lint** sem mutação de arquivos.
2. **Migrações reproduzíveis do zero** — `prisma migrate deploy` num Postgres limpo pega drift, ordem errada e SQL quebrado (ex.: o trigger de ledger).
3. **Boot real do app** — sobe o processo com Postgres+Redis de serviço e envs dummy; valida a `env.validation` (qualquer var nova mal declarada quebra o CI), conexão com Prisma (`SELECT 1`) e o `/health`.
4. **Dockerfile não quebrou** — build da imagem em todo PR; na `main`, publicação no GHCR, que é o gancho pronto para o futuro CD no PaaS.
5. **Jest no automático** — hoje trivial, mas no primeiro `*.spec.ts` commitado o pipeline já o enforceia sem nenhuma mudança extra.

## Mudanças propostas no repositório

1. **`package.json`**
   - Novo script `lint:ci`: `eslint "{src,apps,libs,test}/**/*.ts"` **sem** `--fix` (CI não muta arquivos; o `--fix` do script atual mascara violações corrigíveis).
   - Script `test` ganha `--passWithNoTests` (deixa de falhar trivialmente com a suíte vazia).
2. **`test/app.e2e-spec.ts`** — reescrever o scaffold quebrado em smoke test real: sobe o `AppModule` via `createTestingModule`, verifica `GET /health` → 200 `{status:'ok'}` via supertest, e roda `SELECT 1` via `PrismaService` (valida `DATABASE_URL` + migrações em runtime). Roda local (usa `.env` via ConfigModule) e no CI.
3. **`.nvmrc`** com `24` — alinha CI com a imagem de produção; CI usa `node-version-file`.
4. **`.github/workflows/ci.yml`** (novo) — dispara em `push` para `main` e em todos os PRs:
   - **Job `quality`**: checkout → pnpm via corepack + cache de store → `pnpm install --frozen-lockfile` → `pnpm lint:ci` → `pnpm build` → `pnpm test` → `pnpm prisma validate`.
   - **Job `smoke`**: services `postgres:17-alpine` + `redis:7-alpine`; gera `.env` com valores dummy (as 26 vars — nada de segredos reais); `pnpm prisma migrate deploy` em banco limpo; `pnpm build`; `pnpm test:e2e`.
   - **Job `docker`**: build da imagem (valida Dockerfile em todo PR); no `main`, publica no **GHCR** com tags `sha` + `latest`, com cache GHA. Permissões `packages: write`.
5. **`.github/dependabot.yml`** (novo): atualizações semanais para `npm` e `github-actions`.
6. **`AGENTS.md`**: uma linha na seção de verificação apontando para o CI.

## Ordem de execução

1. Tweaks no repo (scripts, e2e smoke, `.nvmrc`).
2. Rodar `pnpm lint:ci` localmente e corrigir o que aparecer (o `--fix` pode ter mascarado violações até hoje).
3. Criar workflows + dependabot.
4. Verificação local: `pnpm build`, `pnpm lint:ci`, `pnpm test`. Se o Docker estiver rodando, subir o compose (`docker compose up -d`), rodar `migrate deploy` + `pnpm test:e2e` contra ele para validar o smoke de ponta a ponta antes do primeiro push.

## Fora do escopo agora (próximos passos)

- **Deploy automático (CD)**: quando o PaaS for definido, é um workflow a mais — ou o próprio PaaS puxando a imagem do GHCR (tag `latest`/`sha`).
- **Branch protection** exigindo os checks do CI na `main` (passo manual em GitHub Settings → Branches).
- **Testes unitários**: recomendação — começar pela lógica de ledger/wallet (`WalletsRepository.applyOp`, reconciliação), que concentra as invariantes financeiras.
