# Renomeação semântica — overlay.service.ts (esquema A)

## Renomeações (escolha aprovada)
| Atual | Novo | Papel |
|---|---|---|
| `tryDispatch` | `dispatchIfReady` | Porteiro: despacha se widget ativo + sem pausa + palco livre |
| `dispatchNext` | `dispatchNextAlert` | Executor: LPOP → claim → `new_donation` (doação OU teste) |
| `resendCurrentDonation` | `resendCurrentAlert` | Reenvia o alerta em exibição ao client que (re)conectou |

## Mudanças

1. **`src/modules/widgets/overlay.service.ts`** — 3 definições + 9 call sites via replace_all por nome (tokens distintos, sem colisão de substring): `tryDispatch` ×6 (def + 5 chamadas), `dispatchNext` ×4 (def + 3 chamadas), `resendCurrentDonation` ×2 (def + 1 chamada). Zero impacto fora da classe — todos são privates.

2. **`docs/realtime.md`** — atualizar as 5 referências nas linhas 44–48: `tryDispatch` → `dispatchIfReady` (3 ocorrências), `dispatchNext` → `dispatchNextAlert` (2 ocorrências). Ler o trecho antes de editar.

## Verificação
- `pnpm build` + `eslint` no overlay.service.ts.
- Grep confirmando zero ocorrências dos nomes antigos em `src/` e `docs/`.