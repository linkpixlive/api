# Avaliação de Segurança — Módulos Withdrawals e Pix-Keys

> Escopo: `src/modules/withdrawals/*`, `src/modules/pix-keys/*`, `src/infra/db/repositories/withdrawals.repositories.ts`, `src/infra/db/repositories/pix-keys.repositories.ts`, `src/infra/db/repositories/wallets.repositories.ts` (reserve/confirm/refund), `prisma/schema.prisma` (models `Withdrawal`/`PixKey`), `src/modules/webhooks/webhooks.controller.ts` (fluxo de saque), `src/common/security/security.service.ts`, `src/common/utils/mask.util.ts`, `src/common/decorators/is-pix-key.decorator.ts`
> Data: 2026-09-02

## Ranking por Gravidade

| # | Severidade | Vulnerabilidade |
|---|------------|-----------------|
| 1 | 🔴 CRÍTICA | Webhook autenticado por segredo estático em query param, sem HMAC do body nem proteção a replay |
| 2 | 🔴 ALTA | `GET /pix-keys` retorna chaves em texto puro por padrão (sem step-up de autenticação) |
| 3 | 🟠 MÉDIA | `detectKeyType` classifica CPF/CNPJ como `phone` (ordem de regex) → `keyType` e máscara errados |
| 4 | 🟠 MÉDIA | Idempotency-Key com race fora da transação + header sem validação |
| 5 | 🟡 MÉDIA | `MAX_PIX_KEYS_PER_USER` com TOCTOU (count-then-create sem transação/lock) |
| 6 | 🟡 MÉDIA-BAIXA | Cálculo de fee/net com float (`toFixed`) em vez de `Decimal` |
| 7 | 🟢 BAIXA-MÉDIA | `handleWebhookPixSend` reconstrói UUID via `slice()` sem validação de formato |
| 8 | 🟢 BAIXA | Máscara de CPF expõe 6 dígitos centrais |
| 9 | 🟢 BAIXA | `SecurityService` lê `process.env` diretamente |
| 10 | 🟢 BAIXA | Falta `@IsUUID()` em `pixId`/`:id`; `pixValue VARCHAR(255)` pode estourar com chaves longas |

---

### 1. 🔴 CRÍTICA — Webhook sem HMAC real e segredo na URL
- **Arquivos:** `src/modules/webhooks/webhooks.controller.ts:57-71` + `src/modules/withdrawals/withdrawals.service.ts:111-143`
- `hmac` da query é comparado diretamente com `EFI_WEBHOOK_SECRET` (`timingSafeEqual` sobre segredo puro). Não há assinatura do body, timestamp ou nonce. Segredo trafega na URL (logs/proxies/WAF) e permite forjar `gnExtras.idEnvio` → transicionar saques para `FAILED` (refund) ou interferir no fluxo de doações.

### 2. 🔴 ALTA — Exposição de chaves Pix em texto puro por padrão
- **Arquivos:** `src/modules/pix-keys/pix-keys.controller.ts:53-62` + `src/modules/pix-keys/pix-keys.service.ts:69-72,103-107` + `src/modules/pix-keys/entities/pix-key.entity.ts:16`
- `GET /pix-keys` descriptografa e retorna todas as chaves (CPF/CNPJ/email/telefone) com apenas JWT (7 dias), sem re-autenticação ou log de auditoria. Roubo de token/XSS = vazamento total de PII.

### 3. 🟠 MÉDIA — `detectKeyType` com ordem incorreta de regex
- **Arquivos:** `src/modules/pix-keys/pix-keys.service.ts:90-101` + `src/common/decorators/is-pix-key.decorator.ts:10`
- `PIX_PHONE_REGEX (/^\+?\d{10,15}$/)` casa antes de `cpf`/`cnpj`, então chaves só-numéricas de 11/14 dígitos viram `phone`. `keyType` gravado errado e máscara de telefone aplicada a CPF/CNPJ.

### 4. 🟠 MÉDIA — Idempotency-Key com race condition
- **Arquivos:** `src/modules/withdrawals/withdrawals.service.ts:34-43` + `prisma/schema.prisma:218`
- Checagem `findByClientKey` fora do `$transaction`; concorrência com mesma chave passa no check e uma falha com `P2002` (unique `withdrawals_user_client_key`) → 500 em vez de resposta idempotente. Header sem validação de tamanho/formato (`VARCHAR(128)`).

### 5. 🟡 MÉDIA — Limite de chaves com TOCTOU
- **Arquivo:** `src/modules/pix-keys/pix-keys.service.ts:33-42`
- `countByUserId` + `create` sem transação/lock; requisições paralelas ultrapassam `MAX_PIX_KEYS_PER_USER`.

### 6. 🟡 MÉDIA-BAIXA — Aritmética monetária com float
- **Arquivo:** `src/modules/withdrawals/withdrawals.service.ts:71-72`
- `feeAmount`/`netAmount` via `+(amount * pct/100).toFixed(2)` enquanto ledger usa `Decimal`; divergência de centavos e viés sistemático.

### 7. 🟢 BAIXA-MÉDIA — Reconstrução de UUID sem validação no webhook
- **Arquivo:** `src/modules/withdrawals/withdrawals.service.ts:112-114`
- `id.replace/slice` sobre `idEnvio` arbitrário sem checar `/^[0-9a-f]{32}$/i`; IDs curtos/malformados geram UUID inválido e `NotFoundException` não tratada.

### 8. 🟢 BAIXA — Máscara de CPF permissiva
- **Arquivo:** `src/common/utils/mask.util.ts:3-9`
- `***.123.456-**` expõe 6 dígitos centrais; padrão mais seguro é `***.***.***-12`.

### 9. 🟢 BAIXA — `SecurityService` com `process.env` direto
- **Arquivo:** `src/common/security/security.service.ts:13,45`
- Viola `RULES.md §4.1` (usar `ConfigService`); `ENCRYPTION_KEY!` com non-null assertion.

### 10. 🟢 BAIXA — Validação de IDs e tamanho de coluna
- **Arquivos:** `src/modules/withdrawals/dto/create-withdrawal.dto.ts:23` + `src/modules/pix-keys/pix-keys.controller.ts:74` + `prisma/schema.prisma:203`
- `pixId`/`DELETE :id` sem `@IsUUID()`/`ParseUUIDPipe`; `pixValue VARCHAR(255)` estoura para e-mails longos criptografados em base64.
