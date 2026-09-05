# Artefatos de trabalho de agentes

Convenção canônica de onde salvar planos, specs e relatórios gerados por IA — vale para qualquer ferramenta (ZCode, Claude Code, opencode, superpowers…). Cada ferramenta tem pasta interna própria (`.zcode/`, `.worktrees/`, `.opencode/`), que é cache transitório, nunca destino final.

## Mapa

| Artefato | Destino | Nome |
|---|---|---|
| Plano de implementação | `docs/plans/` | `YYYY-MM-DD-<slug>.md` |
| Spec de feature/design | `docs/specs/` | `YYYY-MM-DD-<slug>.md` |
| Registro de decisão (ADR) | `docs/adr/` | `NNNN-<slug>.md` |
| Auditoria/relatório de segurança | `docs/audits/` | `<área>-vulnerabilities.md` ou `YYYY-MM-DD-<slug>.md` |
| Glossário/domínio | `CONTEXT.md` (raiz) | — |

## Regras

- Data em `YYYY-MM-DD`; slug em kebab-case, coerente com o conteúdo.
- Artefato durável vai para `docs/`; caches internos de ferramenta são transitórios e não são referenciados como fonte.
- Pasta nova em `docs/` exige atualizar este arquivo. Proibido criar destinos ad-hoc (`docs/superpowers/`, `plans/` na raiz, `ai-docs/` etc.).
- Spec/plano concluído não é apagado — vira histórico (ex.: os plans de security hardening já concluídos).
- Spec pronta para implementação autônoma pode virar issue `ready-for-agent` no tracker (ver `docs/agents/issue-tracker.md`).
