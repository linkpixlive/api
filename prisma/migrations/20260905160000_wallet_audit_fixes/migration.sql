-- Correções da auditoria docs/audits/wallet-vulnerabilities.md (2026-09-02).

-- Item 1 (crítico): `withdrawal_id` único impedia a segunda linha do ledger no
-- approve/reject do saque (P2002 → rollback → saque preso em pending/processing).
-- Uma linha por (withdrawal_id, type): reserve, confirm e refund coexistem.
-- (constraint E index: cobre bancos criados por caminhos diferentes;
--  IF EXISTS: bancos de dev podem ter derrubado a unique manualmente.)
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_withdrawal_id_key";

DROP INDEX IF EXISTS "transactions_withdrawal_id_key";

CREATE UNIQUE INDEX "transactions_withdrawal_id_type_key" ON "transactions"("withdrawal_id", "type");

-- Item 7: índice composto para a reconciliação (filtro user_id + ordenação created_at).
CREATE INDEX "transactions_user_id_created_at_idx" ON "transactions"("user_id", "created_at");

-- Item 5: FK do ponteiro do ledger (last_transaction_id → transactions.id),
-- com limpeza prévia de ponteiros órfãos (derivariam saldo a partir de zero).
UPDATE "wallets"
SET "last_transaction_id" = NULL
WHERE "last_transaction_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "transactions" t WHERE t."id" = "wallets"."last_transaction_id"
  );

ALTER TABLE "wallets" ADD CONSTRAINT "wallets_last_transaction_id_fkey" FOREIGN KEY ("last_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Unique no ponteiro (exigida pela relação 1:1 no Prisma; um transaction só pode
-- ser o head do ledger de uma wallet).
CREATE UNIQUE INDEX "wallets_last_transaction_id_key" ON "wallets"("last_transaction_id");
