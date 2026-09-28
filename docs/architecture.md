# Arquitetura

> Verificado contra o código em 2026-09-24.

## Camadas

| Camada | Onde | Faz | Não faz |
|---|---|---|---|
| Controller | `modules/<m>/<m>.controller.ts` | valida DTO, delega, retorna entity; `@ApiOperation` + `@ApiResponse`, `@Throttle` | lógica de negócio, Prisma, Redis |
| Service | `modules/<m>/<m>.service.ts` | orquestra regras, lança `HttpException`, mapeia entities | Prisma direto, detalhes de infra |
| Repository | `infra/db/repositories/*.repositories.ts` | Prisma/`$queryRaw`, `$transaction`, parâmetros tipados | regras de negócio, HTTP |
| Contract | `infra/<dom>/contract/*.contract.ts` | classe abstrata da integração externa | — |
| Provider | `infra/<dom>/<provider>/` | implementa o Contract, esconde o SDK | expor tipos do vendor |

Convenções de repository:

- Arquivo no plural (`donations.repositories.ts`), classe singular (`DonationsRepository`). `DbModule` é `@Global()` — não reimportar.
- Parâmetros: **interfaces TS** em `infra/db/repositories/dto/` (não class-validator — a validação já aconteceu no DTO do módulo).
- Repos podem depender de outros e lançar `HttpException` em guardas. **Exceção financeira**: `WalletsRepository.applyOp` lança erros de domínio (`WalletNotFoundError`, `InsufficientBalanceError` em `wallets.errors.ts`) — os erros só viram `HttpException` no service do domínio (ex.: `WithdrawalsService.create`).
- Retornam tipos Prisma; transformação fica no Service/entities.

Entities (`modules/<m>/entities/`): `@Exclude()` na classe, `@Expose()` por campo, factory `fromPrisma()`, `@Transform` Decimal→Number. Serializadas pelo `ClassSerializerInterceptor` global.

## Contracts (integrações externas)

| Contract | Provider | Módulo | Uso |
|---|---|---|---|
| `AiContract.moderate` | `GeminiService` | `AiModule` | moderação de doações (veredito na submissão) |
| `SpeechContract.generateTTS` | `SpeechService` roteia por `voice.provider` (`GradiumService` default, `GoogleService` p/ `google`) | `SpeechModule` | áudio TTS |
| `StorageContract.upload` | `R2Service` (Cloudflare R2) | `StorageModule` | upload de áudio, imagens e vozes |
| `GatewayContract` (`generatePix`, `getPixStatus`, `sendPix`, `getSentPixStatus`) | `EfiService` (Efí/Pix, mTLS, token cache) | `GatewayModule` | Pix |

Injete sempre a abstração, nunca o provider. Exceção: email não tem contract — vai pela fila (`infra/queues/email/`).

## Pipeline global (`main.ts`)

- `helmet`, CORS `origin: '*'`, sem prefixo/versionamento de rota, porta `PORT ?? 3000`.
- `GlobalExceptionFilter` → `{ success: false, error: { message, code } }`; `ResponseInterceptor` → `{ success: true, data, timestamp, path }`; `ClassSerializerInterceptor`.
- Winston envia logs estruturados em JSON para stdout/stderr; a retenção e a coleta ficam a cargo da plataforma de hospedagem. Não há arquivo de log no container.
- `ValidationPipe` global: `whitelist`, `forbidNonWhitelisted`, `transform`; mensagens viram array no `BadRequestException` (o filtro expõe só a primeira).
- Swagger em `/api/docs` quando `NODE_ENV !== 'production'`.

## Guards

- `AuthGuard` + `RolesGuard` globais (APP_GUARD em `AuthModule`): tudo protegido por padrão; `@Public()` libera, `@Roles(UserRole.admin)` restringe.
- `ThrottlerGuard` global (APP_GUARD em `AppModule`) **exceto em `development`**. Detalhes em `docs/security.md`.

## Rotas admin

- Toda rota admin: prefixo `admin/...` + `@Roles(UserRole.admin)` na **classe** do controller — os guards globais aplicam a restrição; nunca `@UseGuards` local.
- Controllers **e services** admin vivem em `src/modules/admin` (`controllers/`, `services/`), mesmo quando o recurso pertence a outro domínio — o módulo admin é a superfície admin centralizada e fala direto com os repositories (globais via `DbModule`).
- Fronteira do service: operação **exclusiva de admin** → service próprio no módulo admin (`AdminVoicesService` sobre `VoicesRepository`); operação **compartilhada** com público/streamer → reusa o service do domínio (`VoicesService.findById` alimenta o TTS, `findActivePublic` o endpoint público); ação cross-domain (aprovar saque, verificar usuário) também ganha service admin próprio.

## Exceções e padrões especiais (não generalizar)

- Cripto (`common/utils/crypto.util.ts`: `encryptData`/`decryptData`/`hashData`) e URL de áudio (`audioUrl.util.ts`) são funções puras que leem env direto (`process.env`) por desenho — não virar service nem migrar para `ConfigService`.

- `webhooks.controller.ts` lança `HttpException` direto — a validação HMAC é fronteira de confiança do webhook.
- `WidgetsModule ⇄ WebsocketModule ⇄ OverlayService` usam `forwardRef`: ciclo por desenho (gateways ⇄ motor da fila).
- O processor da fila injeta services de módulo (`VoicesService`, `OverlayService`) — infra alcança módulos no pipeline de doações.
- Crons vivem em services de módulo: `auth-cleanup` (30min), `withdrawals-scheduler` (5min), `wallets-scheduler` (3h).
- `WidgetSettingsPipe` (request-scoped): escolhe o DTO por `WIDGET_DTO_MAP[type]` para validar o body de settings do widget.
- `common/security/step-up.util.ts`: reautenticação das operações sensíveis, com a exigência por ação em `docs/security.md`. Duas funções: `assertPassword` (só senha) e `assertPasswordWithOptionalTotp` (senha sempre, TOTP adicional quando há 2FA). O TOTP nunca substitui a senha.

## Verificação

- `pnpm build` + `pnpm lint` — **não existe suíte de testes** (zero `*.spec.ts`; o e2e é scaffold morto).
- Package manager: **pnpm**. Postgres/Redis locais: `pnpm compose:up` (portas 5433/6380).
