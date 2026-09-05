# Avaliação de Segurança — Módulos Donations / Donation-Settings / Widgets

> Escopo: `src/modules/donations/*`, `src/modules/donation-settings/*`, `src/modules/widgets/*`, `src/infra/db/repositories/widget.repositories.ts`, `src/infra/db/repositories/donations.repositories.ts`, `prisma/schema.prisma` (models `Donation`/`DonationSettings`/`Widget`/`Voice`), `src/infra/websocket/overlay.gateway.ts`.  
> Data: 2026-09-02

## Ranking por Gravidade

| # | Severidade | Vulnerabilidade |
|---|------------|-----------------|
| 1 | 🔴 ALTA | Bypass de rate-limit em `POST /donation` — throttlers nomeados não registrados |
| 2 | 🟠 MÉDIA | Doações aceitas para usuários desativados (`active = false`) |
| 3 | 🟠 MÉDIA | Autenticação de webhook via segredo estático em query string sem assinatura do payload |
| 4 | 🟠 MÉDIA | Sem limite superior em `amount` / limites de settings excedem schema |
| 5 | 🟠 MÉDIA | BOLA em `alert_finished` do overlay — atualiza qualquer `donationId` sem checar dono |
| 6 | 🟡 BAIXA | Rota pública de widget ignora `:type` e expõe token; sem `@Throttle` explícito |
| 7 | 🟡 BAIXA | `DonationDto.name` sem `@IsString`/`@IsNotEmpty` — omissão gera 500 |
| 8 | 🟡 BAIXA | `PATCH /donation-settings` com `aiModeration` gera 500 (coluna inexistente) |
| 9 | 🟡 BAIXA | Lógica de valores mínimos falha — ambos `minTextAmount` e `minAudioAmount` exigidos sempre |
| 10 | 🟢 BAIXA | CORS `origin: '*'` global + gateway WS |
| 11 | 🟢 BAIXA | `findByToken` retorna `include: { user: true }` (hash de senha, totpSecret) |
| 12 | 🟢 BAIXA | `getAudioUrl` usa `process.env.BUCKET_URL` fora do `ConfigService` |

---

### 1. 🔴 ALTA — Bypass de rate-limit em `POST /donation`
- **Arquivos:** `src/modules/donations/donations.controller.ts:54-57` + `src/app.module.ts:42-96`
- `@Throttle({ donation_create: ... })` e `username_lookup`/`webhook_burst`/`webhook_sustained` usam nomes não definidos em `ThrottlerModule.forRoot()` — no `@nestjs/throttler@6` são silenciosamente ignorados. O limite de 15/h em doações não existe; resta apenas `burst: 2/10s` (~720 Pix/h/IP).

### 2. 🟠 MÉDIA — Doações aceitas para usuários desativados
- **Arquivos:** `src/modules/donations/donations.service.ts:29-76` + `prisma/schema.prisma:82`
- `getUser()` e `donation()` não verificam `user.active`. Doador paga Pix para conta desativada; saldo vai para wallet inacessível até reativação.

### 3. 🟠 MÉDIA — Webhook sem assinatura do payload
- **Arquivo:** `src/modules/webhooks/webhooks.controller.ts:63-72` (aciona `donationsService.webhookPix`)
- Compara `?hmac=` direto com o segredo — não assina o body, vaza em logs/proxies e permite replay para `txid` arbitrário.

### 4. 🟠 MÉDIA — Sem limite superior em `amount`
- **Arquivos:** `src/modules/donations/dto/donation.dto.ts:24-27` + `src/modules/donation-settings/dto/update-donation-settings.dto.ts:5-9`
- `amount` só tem `@Min(1)`; `maxLength` sem `@Max` (coluna `VarChar(500)`) e `@Min(0)` permite bloquear todas as mensagens.

### 5. 🟠 MÉDIA — BOLA em `alert_finished`
- **Arquivos:** `src/modules/widgets/overlay.service.ts:94-97` + `src/infra/websocket/overlay.gateway.ts:50-59`
- Atualiza qualquer `donationId` para `displayed` sem verificar `donation.userId === widget.userId` (requer token do overlay).

### 6. 🟡 BAIXA — Rota pública de widget ignora `:type`
- **Arquivos:** `src/modules/widgets/widgets.controller.ts:55-63` + `src/infra/db/repositories/widget.repositories.ts:10-15`
- `findByToken` não filtra por tipo; resposta inclui o próprio token; sem `@Throttle` explícito; token em path vaza em logs.

### 7. 🟡 BAIXA — `DonationDto.name` sem validadores obrigatórios
- **Arquivo:** `src/modules/donations/dto/donation.dto.ts:13-16` + `prisma/schema.prisma:172`
- Falta `@IsString`/`@IsNotEmpty`; `name` omitido passa na validação e quebra em `NOT NULL` (500).

### 8. 🟡 BAIXA — `aiModeration` gera 500
- **Arquivos:** `src/modules/donation-settings/dto/update-donation-settings.dto.ts:29-31` + `src/infra/db/repositories/dto/donation-settings.dto.ts:1-9` + `prisma/schema.prisma:275-291`
- DTO expõe `aiModeration`, mas schema só tem `filterSpam`/`filterProfanity` — Prisma lança `Unknown arg`.

### 9. 🟡 BAIXA — Lógica de valores mínimos incorreta
- **Arquivo:** `src/modules/donations/donations.service.ts:86-96`
- Ambos `minTextAmount` e `minAudioAmount` são exigidos incondicionalmente; mínimo efetivo = `max(ambos)`, rejeitando doações pequenas sem áudio.

### 10. 🟢 BAIXA — CORS `origin: '*'`
- **Arquivos:** `src/main.ts:16` + `src/infra/websocket/overlay.gateway.ts:17`
- Aberto globalmente em HTTP e WS.

### 11. 🟢 BAIXA — `findByToken` expõe usuário completo
- **Arquivo:** `src/infra/db/repositories/widget.repositories.ts:10-15`
- `include: { user: true }` retorna hash de senha e `totpSecret`; um uso descuidado vaza PII.

### 12. 🟢 BAIXA — `process.env` fora do bootstrap
- **Arquivo:** `src/common/utils/audioUrl.util.ts:2`
- Usa `process.env.BUCKET_URL` em vez de `ConfigService`, violando `RULES.md §4.1.3`.
