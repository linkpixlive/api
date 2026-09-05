# Seed completo para desenvolvimento (`prisma/seed.ts`)

## Problema atual
O seed cria apenas: usuário admin + wallet + chave Pix + 1 transação de auditoria. Consequências em dev:
- **Página pública de doação quebra**: `DonationsService.getUser` exige `DonationSettings` (404 sem ele).
- **`POST /donations` quebra**: exige uma `Voice` ativa (`voiceId`) e `DonationSettings`.
- **Processador da fila quebra**: exige widget `overlay` do usuário.
- **Dashboard vazio**: sem histórico de doações; **carteiras sem ledger real** (só 1 entrada).

## O que o novo seed cria (idempotente — pode rodar várias vezes)

1. **Catálogo de `Voice`** (só se a tabela estiver vazia): Ricardo (`pt-BR-Wavenet-B`, google), Francisca (`pt-BR-Wavenet-A`, google), padrão Gradium (`YHOBjtajNBEHUI_K`, id real usado no código) e 1 voz **inativa** para testar o filtro de `findActive`. O `defaultVoiceId` aponta para "Ricardo" (nome usado no `defaultNarrator` do overlay).
2. **Usuário admin** (como hoje) **+ 1 usuário streamer** simples (`streamer@linkpix.com` / `streamer`, `verified: false`) para testar os fluxos de admin (verificação de usuário etc.).
3. **`DonationSettings`** via upsert por usuário (admin: `filterProfanity`/`filterSpam` ligados + `blockedWords` de exemplo; streamer: defaults do schema) — `update: {}` para não sobrescrever ajustes manuais de dev ao re-executar.
4. **Widgets** `overlay` + `qrcode` via upsert (`@@unique userId+type`), com exatamente os mesmos defaults de `WidgetsService.getDefaultSettings` (`defaultNarrator: 'Ricardo'`).
5. **PixKey** (garantia: cria só se o admin não tiver) — criptografia via `SecurityService` + `maskPixKey`, como hoje.
6. **8 doações de exemplo** (apenas se o admin não tiver nenhuma), espalhadas nos últimos 7 dias para povoar gráficos/histórico:
   - 2 `displayed` + 2 `paid` → com `approvedAt`, `voiceUrl` fake (`tts/<username>-<id>.wav`) para áudio, **e crédito no ledger**;
   - 1 `expired` + 1 `failed` → sem crédito (cobre os filtros de status);
   - 2 `pending` (com pix fake e `expiredAt` = agora+15min) → prontas para testar webhook/fila.
7. **2 saques**: 1 `success` (reserve → confirm, taxa 4% conforme `.env.example`) e 1 `pending` (só reserve) → demonstra `pendingBalance > 0`, `clientKey` de idempotência e os tipos `withdraw_reserve`/`withdraw_confirm` no ledger.
8. **Ledger consistente**: helper local que espelha `WalletsRepository.applyOp` (novo saldo derivado do **último registro do ledger**, nunca do cache; wallet cache + `lastTransactionId` atualizados juntos, respeitando o trigger `wallets_balance_guard`), com `createdAt` explícito e crescente por entrada — o `reconcile` ordena por `createdAt`, e dentro de uma transação Postgres todos os `now()` seriam idênticos, o que deixaria a cadeia ambígua. Tudo em um único `$transaction` (all-or-nothing).
   - Saldo final do admin: R$ 10.000 + R$ 180 (doações) − R$ 100 (saque confirmado) − R$ 50 (saque pendente) = **R$ 10.030,00** com R$ 50,00 pendentes.

## Verificação
- `pnpm build` + `pnpm lint` (exigidos pelo AGENTS.md).
- Typecheck do seed; se houver Postgres local acessível (docker-compose), rodar `pnpm db:seed` **duas vezes** para validar execução + idempotência.