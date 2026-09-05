# Plano — Endpoints públicos do fluxo de doação

> Data: 2026-09-05 · Status: aprovado
> Par: plano frontend `linkpix-frontend/docs/plans/2026-09-05-integracao-doacoes-backend.md`

## Objetivo

Dar ao frontend público (página de doação `/:username`) o que falta para operar sem mocks:

1. `POST /donation` aceitando doação **sem voz** (opção "Voz padrão do streamer").
2. `GET /donation/:id` público — status + resumo da doação (página de confirmação `/doacao/:id`).
3. `GET /voices` público — vozes ativas do formulário, com amostra de áudio opcional (`sampleUrl`).

## 1. `POST /donation`: voz opcional + mínimo por `minTextAmount`

- `modules/donations/dto/donation.dto.ts`: `voiceId` vira `@IsOptional()` + `@IsUUID('4')` (sem `@IsNotEmpty`). Coluna já nullable no Prisma; o processor já trata `voiceId` nulo (`donations-queue.processor.ts`).
- `modules/donations/donations.service.ts`:
  - Voz validada (`findById` + `isActive`) somente quando `voiceId` for informado.
  - Mínimo de valor: **apenas `amount >= minTextAmount`** para toda doação. A checagem atual de `minAudioAmount` é removida do fluxo — `minAudioAmount` fica reservado para a futura gravação de áudio por microfone e continua existindo em `DonationSettings`/dashboard.

## 2. `GET /donation/:id` público

- `DonationsController` (classe `@Public()`): `@Get('donation/:id')` com `ParseUUIDPipe` e `@Throttle` (`burst` + novo nomeado `donation_status` em `ThrottlerModule.forRoot`).
- `DonationsRepository.findByIdWithRelations(id)`: include `user { name, username }` e `voice { name }`.
- `DonationsService.getPublicDonationView(id)` → `NotFoundException` quando inexistente.
- Nova `entities/donation-public.entity.ts`: `{ id, status, amount (Number), donorName, message, streamerName, streamerUsername, voiceName, createdAt, expiredAt }`. Nome/mensagem do doador já são públicos no alerta; id é UUID.

## 3. `GET /voices` público com `sampleUrl` opcional

- `prisma/schema.prisma`: `Voice.sampleUrl String? @map("sample_url") @db.VarChar(500)` + migration (`pnpm db:migrate`).
- `create-voice.dto.ts` / `update-voice.dto.ts`: `sampleUrl` opcional; `VoiceEntity` expõe o campo.
- Novo controller público `@Controller('voices')` com `@Public() @Get()` → `voicesService.findActive()` (existente). Throttle `burst`/`standard`.
- Nova `PublicVoiceEntity { id, name, provider, sampleUrl | null }` — sem `voiceId` do provedor, `isActive`, `createdAt`.

## Verificação

- `pnpm build && pnpm lint`.
- Smoke dos endpoints via Swagger/curl (backend local): `GET /user/:username`, `POST /donation` (com e sem `voiceId`), `GET /donation/:id`, `GET /voices` (com e sem `sampleUrl`).
- Sem E2E automatizado/browser — decisão do produto para este escopo.
