# Arquitetura

> Verificado contra o código em 2026-09-02.

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
- Repos podem depender de outros e lançar `HttpException` em guardas (ex.: `WalletsRepository.applyOp`).
- Retornam tipos Prisma; transformação fica no Service/entities.

Entities (`modules/<m>/entities/`): `@Exclude()` na classe, `@Expose()` por campo, factory `fromPrisma()`, `@Transform` Decimal→Number. Serializadas pelo `ClassSerializerInterceptor` global.

## Contracts (integrações externas)

| Contract | Provider | Módulo | Uso |
|---|---|---|---|
| `AiContract.cleanMessage` | `GeminiService` | `AiModule` | moderação de mensagens |
| `SpeechContract.generateTTS` | `GradiumService` (Google também registrado) | `SpeechModule` | áudio TTS |
| `StorageContract.uploadAudio` | `R2Service` (Cloudflare R2) | `StorageModule` | upload de áudio |
| `GatewayContract` (`generatePix`, `getPixStatus`, `sendPix`, `getSentPixStatus`) | `EfiService` (Efí/Pix, mTLS, token cache) | `GatewayModule` | Pix |

Injete sempre a abstração, nunca o provider. Exceção: email não tem contract — vai pela fila (`infra/queues/email/`).

## Pipeline global (`main.ts`)

- `helmet`, CORS `origin: '*'`, sem prefixo/versionamento de rota, porta `PORT ?? 3000`.
- `GlobalExceptionFilter` → `{ success: false, error: { message, code } }`; `ResponseInterceptor` → `{ success: true, data, timestamp, path }`; `ClassSerializerInterceptor`.
- `ValidationPipe` global: `whitelist`, `forbidNonWhitelisted`, `transform`; mensagens viram array no `BadRequestException` (o filtro expõe só a primeira).
- Swagger em `/api/docs` quando `NODE_ENV !== 'production'`.

## Guards

- `AuthGuard` + `RolesGuard` globais (APP_GUARD em `AuthModule`): tudo protegido por padrão; `@Public()` libera, `@Roles(UserRole.admin)` restringe.
- `ThrottlerGuard` global (APP_GUARD em `AppModule`) **exceto em `development`**. Detalhes em `docs/security.md`.

## Exceções e padrões especiais (não generalizar)

- `webhooks.controller.ts` lança `HttpException` direto — a validação HMAC é fronteira de confiança do webhook.
- `WidgetsModule ⇄ WebsocketModule ⇄ OverlayService` usam `forwardRef`: ciclo por desenho (gateways ⇄ motor da fila).
- O processor da fila injeta services de módulo (`VoicesService`, `OverlayService`) — infra alcança módulos no pipeline de doações.
- Crons vivem em services de módulo: `auth-cleanup` (30min), `withdrawals-scheduler` (5min), `wallets-scheduler` (3h).
- `WidgetSettingsPipe` (request-scoped): escolhe o DTO por `WIDGET_DTO_MAP[type]` para validar o body de settings do widget.

## Verificação

- `pnpm build` + `pnpm lint` — **não existe suíte de testes** (zero `*.spec.ts`; o e2e é scaffold morto).
- Package manager: **pnpm**. Postgres/Redis locais: `pnpm compose:up` (portas 5433/6380).
