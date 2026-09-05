# LinkPix API — Guia para agentes

Backend da plataforma **LinkPix** (nome legado: Tipply): doações em lives via Pix, overlay de alertas com TTS, carteira e saques. NestJS 11 · Prisma 7 + Postgres · Redis · BullMQ · Socket.IO.

## Invariantes (valem para qualquer tarefa)

- **Camadas**: Controller → Service → Repository (`infra/db/repositories/`) / Contract. Prisma só em repositories; integração externa só via Contract (`infra/*/contract/`).
- **Erros**: lance `HttpException` — o envelope global (`{ success, data | error }`) cuida do resto. Nada de `res.json`, filtro custom ou try/catch reformatando.
- **Entrada/saída**: DTOs com `class-validator`; respostas via entities com `@Expose`.
- **Dinheiro**: mutação financeira sempre em `$transaction` via `WalletsRepository.applyOp` (ledger é a fonte da verdade).
- **Redis**: só via `RedisService`; chave nova = builder em `redis-keys.ts` + TTL + documentação em `docs/data.md`.
- **Env**: só via `ConfigService` (exceto bootstrap); variável nova entra em `env.validation.ts` + `.env(.example)`.
- **Decimal**: valores monetários com `Decimal` do Prisma, nunca float.
- **Verificação**: `pnpm build` + `pnpm lint` — não há suíte de testes.

## Documentação detalhada (leia o que for tocar)

| Doc | Leia quando |
|---|---|
| [CONTEXT.md](CONTEXT.md) | precisar de visão do produto, módulos ou fluxos ponta a ponta |
| [docs/architecture.md](docs/architecture.md) | criar/alterar controller, service, repository, entity ou contract |
| [docs/data.md](docs/data.md) | tocar em Prisma, schema, migrations, wallet/ledger ou Redis |
| [docs/realtime.md](docs/realtime.md) | tocar em filas BullMQ, pipeline de doações, WebSocket, TTS ou fila de alertas |
| [docs/security.md](docs/security.md) | tocar em auth, sessões, 2FA, cripto, throttling, webhook Efí ou env vars |
| [docs/agents/artifacts.md](docs/agents/artifacts.md) | salvar plano, spec, ADR ou relatório |

## Artefatos de trabalho

Planos → `docs/plans/` · specs → `docs/specs/` · ADRs → `docs/adr/` · auditorias → `docs/audits/`. Nome: `YYYY-MM-DD-<slug>.md`. Vale para qualquer ferramenta de IA — detalhes em [docs/agents/artifacts.md](docs/agents/artifacts.md).

## Agent skills

- **Issue tracker**: issues vivem como GitHub issues em `linkpixlive/api`, via `gh` CLI — `docs/agents/issue-tracker.md`.
- **Triage labels**: cinco papéis canônicos (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) — `docs/agents/triage-labels.md`.
- **Domain docs**: `CONTEXT.md` na raiz + `docs/adr/`; use o vocabulário do glossário — `docs/agents/domain.md`.
