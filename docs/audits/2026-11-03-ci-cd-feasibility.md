# Análise — Viabilidade de CI/CD no linkpix-api

**Data:** 2026-11-03 · **Base:** [docs/plans/2026-09-02-ci-cd-pipeline.md](../plans/2026-09-02-ci-cd-pipeline.md) + código atual · **Conclusão:** CI viável e implementado; CD recomendado via Auto-Deploy "After CI Checks Pass" do Render

## 1. Estado no momento da análise

O plano de CI de 2026-09-02 **nunca havia sido implementado** — o repo estava exatamente no estado "antes" descrito por ele:

- Sem `.github/` (zero workflows, zero dependabot) em todo o histórico do git.
- `pnpm lint` usa `--fix` (mascara violações); não havia `lint:ci`.
- `pnpm test` = `jest` puro → falha trivialmente com "No tests found" (zero `*.spec.ts` em `src/`).
- `test/app.e2e-spec.ts` ainda era o scaffold do Nest: testava `GET /` esperando "Hello World!" — rota que não existe (`src/app.controller.ts` nem existe; o app tem `/health`).
- Sem `.nvmrc`; Docker usa `node:24-slim`.
- `pnpm-workspace.yaml` com placeholders literais `"set this to true or false"` nas chaves `allowBuilds` (gerado pelo fluxo de aprovação do pnpm e nunca preenchido) — comportamento indefinido para scripts de build de dependências; o Dockerfile contornava com `--dangerously-allow-all-builds`.

Deltas relevantes desde o plano original:

- **15 migrations** (eram 9), incluindo SQL customizado (trigger `wallets_balance_guard`, fixes de audit, moderação por IA) — o maior risco de produção atual é drift/SQL quebrado em migration.
- **29 env vars** no `.env.example` (25 obrigatórias validadas em `src/common/config/env.validation.ts` com `skipMissingProperties: false` — o app morre no bootstrap se faltar qualquer uma).
- Dockerfile já roda `prisma migrate deploy` no boot (CMD com `DATABASE_MIGRATE_URL` fallback para `DATABASE_URL`) — commit `08e7bbb`.
- Prisma 7 com driver adapter (`@prisma/adapter-pg`) — conexão com o banco é **lazy** (o app sobe sem Postgres; DB só é tocado na primeira query de repositório). Redis idem: ioredis com `maxRetriesPerRequest: null` conecta em background e só loga `warn` se estiver fora.
- `/health` é **shallow** (liveness, não toca DB/Redis) mas é **throttled** (60/min) e o `ThrottlerGuard` global usa `ThrottlerStorageRedisService` → qualquer request (até `/health`) depende de Redis real. Com `NODE_ENV=development` o guard nem é registrado.
- **Nenhuma integração externa é contatada no bootstrap** (Efí, Gradium, R2, Resend, Gemini são lazy) → smoke test funciona com envs dummy, exigindo apenas formatos válidos: `ENCRYPTION_KEY` = 64 hex, `JWT_SECRET` ≥ 32 chars, `EFI_CERTIFICATE_BASE64` = base64, URLs `http://localhost` são aceitas (sem TLD).

## 2. CI — viabilidade e benefícios

**Viável, sem ressalvas.** Implementado em 2026-11-03 (`.github/workflows/ci.yml`, 3 jobs independentes):

1. **`quality`** — install frozen-lockfile → `lint:ci` (sem `--fix`) → `nest build` → `jest --passWithNoTests` → `prisma validate`.
2. **`smoke`** — Postgres 17 + Redis 7 como services do GitHub Actions; envs dummy; `prisma migrate deploy` **do zero** (pega drift, ordem errada e SQL quebrado — hoje seria o único guardião das 15 migrations); boot real do `AppModule` com `NODE_ENV=production` (valida as 25 envs) e e2e: `GET /health` → 200 com envelope `{ success, data }` + `SELECT 1` via `PrismaService`.
3. **`docker`** — build da imagem em todo push/PR (cache GHA). Publicação no GHCR **deliberadamente adiada** até o CD por imagem ser adotado (evita acumular quota de pacotes privados).

Benefícios mesmo sem suíte de testes: compilação + lint sem mutação garantidos por commit; migrações reproduzíveis do zero; boot real validando env validation (var nova mal declarada quebra o CI em vez de produção); Dockerfile sob teste contínuo; e o primeiro `*.spec.ts` commitado já nasce enforceado pelo pipeline.

Tweaks de repo incluídos: `lint:ci`, `--passWithNoTests` no `test`, `.nvmrc` = 24, `allowBuilds` normalizado (`true`: `@prisma/engines`, `prisma`, `msgpackr-extract`, `unrs-resolver`; `false`: `@nestjs/core`, `@scarf/scarf`, `protobufjs`), dependabot semanal (npm + actions).

## 3. CD — avaliação para o Render free tier

### 3.1 Situação atual

O Render faz auto-deploy **"On Commit"**: novo commit na `main` → Render builda a imagem do Dockerfile → no boot roda `prisma migrate deploy` e sobe o app. O CI (quando existir) seria apenas informativo — **commit quebrado vai direto para produção**:

- Compile error, env faltando ou migration com SQL ruim → deploy falha no boot → serviço fora até intervenção manual no dashboard.
- GitHub fica verde (nenhum sinal do problema lá).
- Sem Health Check Path configurado, o Render considera o deploy "live" assim que o container inicia — um boot que crasheia depois não cancela o deploy nem preserva a versão anterior automaticamente.

### 3.2 Opções (todas disponíveis no free tier)

**A. Auto-Deploy "After CI Checks Pass" (recomendada — adotada)**

Setting nativo do serviço no Render (Settings → Auto-Deploy → *After CI Checks Pass*). O Render observa a GitHub checks API e só dispara o deploy quando **todos** os checks do commit terminam com `success`, `neutral` ou `skipped`. Check falho **ou nenhum check detectado** → não deploya.

- ✅ Zero segredos, zero código extra, zero acoplamento.
- ✅ Deploy só de commit verde; commit quebrado morre no CI, visível no GitHub.
- ⚠️ Artefato é **rebuildado** pelo Render (mesmo commit, não os mesmos bytes) — com lockfile congelado, risco aceitável.
- ⚠️ Se o CI estiver quebrado/flaky, deploys param silenciosamente → mitigar com notificações de deploy (email/Slack) no Render.
- ⚠️ Enquanto o CI não rodar num commit (config recém-mexida), nada deploya → só ativar a flag depois do primeiro CI verde na `main`.

**B. Deploy Hook pós-CI**

Auto-deploy off; último job do workflow (condicionado a `main` + jobs verdes) faz `curl $RENDER_DEPLOY_HOOK_URL` (segredo no GitHub). Faz sentido quando o deploy precisa ser condicionado a algo que os checks não expressam (ex.: deploy só por tag de release, aprovação manual via GitHub Environments — que em repo privado exige plano pago do GitHub). Hoje não há essa necessidade; opção B é complexidade sem ganho.

**C. GHCR + serviço image-backed**

CI publica imagem (tags `sha` + `latest`) no GHCR; serviço no Render vira "Existing Image" e o deploy é `pull` + start (disparado por hook/API — imagem não tem "push detection"). Ganhos: **paridade exata de artefato** (a imagem testada é a que roda) e deploys mais rápidos no Render (sem build). Custos: credencial de registry (`read:packages`) no Render, storage de pacotes privados no GHCR conta para a quota do GitHub (cleanup de tags no workflow), mais peças móveis. É a evolução natural se deploys do Render ficarem lentos ou se a paridade de artefato importar.

### 3.3 Endurecimentos de deploy (independentes da opção)

1. **Health Check Path = `/health`** no Render: durante o deploy, a nova instância só recebe tráfego se o health check passar; falha repetida (~15 min) cancela o deploy e **a versão anterior continua servindo** (rollback automático). Cobre o caso pior: migration aplicada + boot quebrado. Ativar **antes** do gating por checks.
2. **Throttler × health check**: gotcha documentado do Render é o rate limiter bloquear o health check. `/health` tem 60/min — suficiente para os checks do Render; se um dia estourar, excluir a rota do throttler.
3. **Branch protection na `main`** (GitHub Settings → Branches): exigir os checks `quality`/`smoke`/`docker` e, opcionalmente, exigir PRs. Passo manual; admins podem bypass.
4. **Notificações de deploy** (email/Slack) no Render — é o alarme para "CI verde mas deploy falhou" ou "deploys pararam".
5. **Migrações expand/contract**: single instance no free tier = breve downtime a cada deploy (rolling deploys exigem instância paga) e a janela de deploy inclui `migrate deploy`. Migração breaking precisa ser compatível com o código da versão anterior (padrão já seguido no repo — ver `docs/plans/2026-08-12-med-and-fee-ledger.md`).
6. **Realidade do free tier**: spin-down após ~15 min de inatividade (cold start na primeira request) — CI/CD não muda isso; keep-alive é outro tema.

## 4. Sequência de ativação do CD

1. ✅ CI implementado e rodando verde na `main`.
2. No Render: **Health Check Path = `/health`** (imediatamente).
3. Merge do PR de CI na `main` → conferir checks verdes.
4. No Render: **Auto-Deploy = "After CI Checks Pass"** + notificações ativas.
5. No GitHub: branch protection exigindo os 3 checks na `main`.
6. Teste negativo: push de commit quebrado em branch → PR vermelho → nenhum deploy.

## 5. Referências

- Render — Deploying on Render / Auto-Deploy after CI checks: https://render.com/docs/deploys
- Render — Deploy Hooks (disponíveis no free tier): https://render.com/docs/deploy-hooks
- Render — Health Checks e rollback automático em deploy falho: https://render.com/docs/health-checks · https://render.com/articles/how-render-handles-deploy-failures
- Render — Deploy a prebuilt image (opção C): https://render.com/docs/deploying-an-image
- Render — Free tier (spin-down, limites): https://render.com/docs/free
