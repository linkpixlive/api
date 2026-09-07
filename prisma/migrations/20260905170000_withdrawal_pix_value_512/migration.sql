-- Correções da auditoria docs/audits/withdrawals-pix-keys-vulnerabilities.md (2026-09-02).

-- Item 10: `pix_value` armazenava a chave Pix criptografada (base64 com IV e
-- auth tag) em VarChar(255); e-mails longos podem ultrapassar esse limite após
-- a criptografia. Ampliar para VarChar(512).
ALTER TABLE "withdrawals" ALTER COLUMN "pix_value" TYPE VARCHAR(512);
