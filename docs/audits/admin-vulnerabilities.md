# Avaliação de Segurança — Módulo Admin

> Escopo: `src/modules/admin/*`, `src/infra/db/repositories/withdrawals.repositories.ts`, `src/modules/auth/auth.guard.ts`, `src/common/guards/roles.guard.ts`
> Data: 2026-09-02

## Ranking por Gravidade

| # | Severidade | Vulnerabilidade |
|---|------------|-----------------|
| 1 | 🔴 CRÍTICA | Race condition reject durante approve em processing → Pix pago + wallet reembolsado (double spend) |
| 2 | 🔴 CRÍTICA | Status retornado por `sendPix` ignorado — FAILED/PROCESSING marcado como success |
| 3 | 🟠 ALTA | TOCTOU em `processingWithdrawal` (pending → processing não atômico) |
| 4 | 🟡 MÉDIA | Sem trilha de auditoria por admin (quem aprovou/rejeitou/verificou) |
| 5 | 🟡 MÉDIA | Destino do Pix chaveado por `NODE_ENV` |
| 6 | 🟡 MÉDIA | Usuário desativado mantém acesso até expirar sessão (até 7 dias) |
| 7 | 🟢 BAIXA | Sem `@Throttle` e sem validação `@IsUUID` nos params `id` |
| 8 | 🟢 BAIXA | CORS `origin: '*'` em `main.ts` |

---

### 1. 🔴 CRÍTICA — Race condition reject durante approve
- **Arquivos:** `src/modules/admin/services/admin-withdrawals.service.ts:18-48` + `src/infra/db/repositories/withdrawals.repositories.ts:170-176`
- `approve` deixa o saque em `processing` durante `sendPix`; `reject` aceita `processing` e reembolsa. Pix enviado + reembolso = perda financeira.

### 2. 🔴 CRÍTICA — Status do gateway ignorado
- **Arquivo:** `src/modules/admin/services/admin-withdrawals.service.ts:32-44`
- `gatewayContract.sendPix` retorna `SUCCESS|FAILED|PROCESSING` mas `approveWithdrawal` é chamado incondicionalmente; timeout após envio real também cai no `catch` → reject + reembolso indevido.

### 3. 🟠 ALTA — TOCTOU em processingWithdrawal
- **Arquivo:** `src/infra/db/repositories/withdrawals.repositories.ts:96-119`
- Leitura de `status` + `update` incondicional em vez de `updateMany` condicional como em `approveWithdrawal:131` e `rejectWithdrawal:170`.

### 4. 🟡 MÉDIA — Sem auditoria por admin
- **Arquivos:** `src/modules/admin/services/admin-withdrawals.service.ts:18` + `src/modules/admin/services/admin-users.service.ts:9`
- `GatewayResponse` existe para chamadas ao gateway, mas não há registro de qual `admin` executou approve/reject/verify.

### 5. 🟡 MÉDIA — NODE_ENV controla destino do Pix
- **Arquivo:** `src/modules/admin/services/admin-withdrawals.service.ts:27-30`
- `NODE_ENV === 'development'` redireciona pagamentos reais para `efipay@sejaefi.com.br`.

### 6. 🟡 MÉDIA — Desativação não revoga sessão
- **Arquivos:** `src/modules/auth/auth.guard.ts:58-66` + `src/common/guards/roles.guard.ts:14` + `src/modules/auth/auth.service.ts:299`
- `AuthGuard` não checa `user.active`; sessão Redis `auth:session:<sid>` vive `JWT_EXPIRES_IN_DAYS`.

### 7. 🟢 BAIXA — Sem throttle/validação de UUID
- **Arquivo:** `src/modules/admin/controllers/admin.controller.ts:19,32,45`
- Endpoints sem `@Throttle` e `id` sem `@IsUUID`/`ParseUUIDPipe`.

### 8. 🟢 BAIXA — CORS wildcard
- **Arquivo:** `src/main.ts:16`
- `enableCors({ origin: '*' })` com `helmet()` habilitado.
