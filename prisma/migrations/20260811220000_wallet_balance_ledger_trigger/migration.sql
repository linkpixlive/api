-- Ledger-authoritative balance enforcement.
--
-- Invariant: wallets.current_balance may only change when last_transaction_id
-- also changes (i.e. via the ledger-orchestrated financial ops). Direct
-- hand-edits that set current_balance without advancing the ledger pointer
-- are rejected.
--
-- Note: inserts are unaffected (wallets are created with current_balance = 0
-- and no pointer; seed then creates a ledger row and points last_transaction_id
-- at it — both allowed by this trigger).

CREATE OR REPLACE FUNCTION enforce_wallet_balance_ledger()
RETURNS trigger AS $$
BEGIN
  IF NEW.current_balance IS DISTINCT FROM OLD.current_balance
     AND NEW.last_transaction_id IS NOT DISTINCT FROM OLD.last_transaction_id THEN
    RAISE EXCEPTION
      'Direct wallet balance edits are not allowed. Use a ledger transaction (transactions table) so balanceAfter stays authoritative.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wallets_balance_guard ON wallets;

CREATE TRIGGER wallets_balance_guard
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION enforce_wallet_balance_ledger();
