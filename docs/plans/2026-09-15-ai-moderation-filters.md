# Plano — Moderação IA de doações (filtros por streamer)

Data: 2026-09-15 · Status: aprovado (grill em 3 rodadas)

## Contexto

Sistema de moderação de mensagens de doação ativável pelo streamer. Existia um pipeline Gemini dormindo no código (`AiContract.cleanMessage`, comentado no processor da fila, pós-pagamento, com *rewrite* criativo de palavrões) — o desenho novo o substitui: veredito bloqueante **antes do QRCode**, sem modificar mensagem (exceto spam).

## Decisões fechadas

- Toggle mestre `aiModeration` por streamer, **default off**; off = nenhuma IA.
- Filtros opcionais: palavrões (bloqueia; prompt tolera palavrão leve/zoeira de live), discurso de ódio (bloqueia), spam (saneia, não bloqueia), regras custom (**um único input** com palavras e/ou contexto livre; detectar variações).
- Bloqueio **antes de gerar QRCode** (`DonationsService.donation()`, antes de `gateway.generatePix()`). Erro genérico ao doador (sem revelar categoria/palavra).
- Falha/timeout da IA (3s): **fail-open** + log estruturado.
- Moderação cobre **nome + mensagem** na mesma chamada (nome é texto livre por doação).
- Spam: **regras determinísticas em código**, roda antes da IA; a IA avalia o texto já saneado; TTS/overlay recebem o texto final.
- Contract redesenhado para veredito; **Gemini 2.5 Flash** mantido. Fila (post-pagamento) limpa da IA.
- Mensagens bloqueadas: **só log estruturado** (sem tabela, sem status novo).
- Schema: `blockedWords` → `customRules` (texto único, cap 1000); `messageRaw` removida → `message` nasce preenchido na criação.

## Implementação

1. **Prisma** — `DonationSettings`: +`aiModeration`, +`filterHateSpeech`, +`customRules String @default("")`, −`blockedWords`. `Donation`: −`messageRaw`, `message` gravado na criação. Migration com backfill `message = COALESCE(message, messageRaw)` antes do drop.
2. **Sanitizer de spam** (`src/common/utils/`): runs de caractere >5→5; token 2–6 chars repetido ≥3×→2; mash de teclado colapsa repetições internas; emoji >5→5.
3. **Matcher de regras custom**: palavras isoladas do input → match por normalização (lowercase, sem acento, leet `@/0/1`, separadores/espaços, runs colapsados).
4. **`AiContract.moderate()`** → `ModerationVerdict { blocked, categories }`; Gemini temp 0, resposta JSON (`responseSchema`), timeout 3s, fail-open com log. Prompt PT-BR com `customRules` verbatim.
5. **Fluxo de submissão**: toggle off → fluxo atual. filterSpam → sanitiza name/message. Palavra custom → bloqueio imediato sem IA. Demais filtros ativos → `moderate()`; blocked → `BadRequestException` genérica. Doação criada com `message` final.
6. **Fila**: remover `AiContract`/`getCleanMessage`/bloco comentado; `processDonation` não escreve `message`.
7. **Settings API**: expor `aiModeration`, `filterProfanity`, `filterSpam`, `filterHateSpeech`, `customRules` (`@MaxLength(1000)`).
8. **Docs**: `realtime.md` (estágio 4 do pipeline), `data.md` (schema), `architecture.md` (tabela de contracts).

Verificação: `pnpm build` + `pnpm lint` (sem suíte de testes).

## Backlog (registrado, não aplicado)

- Dashboard "mensagens bloqueadas" (exige persistir tentativas).
- Endpoint "testar regras" para o streamer.
- Cache Redis de vereditos (throttle 15/h/IP já limita custo).
- Router multi-provider de IA (padrão speech) quando houver 2º provider.
- Métricas/feedback de falso positivo por streamer.
