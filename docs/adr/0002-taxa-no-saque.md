# 0002 — Taxa da plataforma cobrada no saque, não na doação

- **Status:** accepted
- **Data:** 2026-09-22 (decisão original: plano MED, `docs/plans/2026-08-12-med-and-fee-ledger.md`)

## Contexto

Duas opções para a remuneração da plataforma sobre doações: descontar no recebimento (streamer vê líquido na hora) ou no saque (streamer vê bruto acumular, taxa descontada ao sacar). Padrão de plataformas de creators pesa a favor da segunda.

## Decisão

- Doação recebida credita o **bruto** na carteira (`WalletsRepository.applyOp`, ledger como fonte da verdade).
- No saque, `WithdrawalsService.create` calcula `feeAmount = gross × WITHDRAWAL_FEE_PERCENTAGE` (env) e `netAmount = gross − fee`, persistidos no `Withdrawal` (`gross_amount`, `fee_amount`, `net_amount`).
- Disputas MED revertem pelo **bruto** (`donation.amount`), com `blockedBalance` cobrindo déficit quando o saldo não basta.

## Consequências

- Extrato do streamer mostra bruto nas doações e taxa explícita só no saque — alinhado ao padrão do setor, mas exige exibir a taxa antes da confirmação do saque (frontend).
- Mudar para taxa-na-doação exigiria reescrever ledger, MED e telas — custo alto, decisão estável.
