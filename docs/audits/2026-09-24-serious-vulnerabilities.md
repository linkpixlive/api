# Auditoria de Vulnerabilidades — Backend LinkPix

> Data: 2026-09-24
> Escopo: backend NestJS em `src/`, Prisma/migrations e dependências de produção efetivamente alcançáveis.
> Base analisada: commit `0d24d53` mais as correções locais implementadas após a auditoria.
> Execução: `pnpm audit --prod --audit-level high`, leitura de todos os módulos e rastreamento dos fluxos de ponta a ponta.

## Legenda

- ✅ **Corrigida** — falha fechada no working tree atual.
- 🔴 **Aberta** — falha confirmada e ainda explorável.
- 🟡 **Condicional** — controle ausente; impacto depende de comportamento externo ainda não comprovado apenas pelo backend.
- 🟠 **Média aberta** — risco real, abaixo do corte de prioridade Alta/Crítica desta auditoria.

## Resumo executivo

| # | Severidade | Status | Vulnerabilidade |
|---|---|---|---|
| 1 | Alta | ✅ Corrigida | 2FA podia ser contornado e sessões antigas permaneecem válidas |
| 2 | Alta | ✅ Corrigida | Tokens de recuperação sobreviviam à troca de senha e podiam ser reaproveitados |
| 3 | Alta | ✅ Corrigida | Cleanup podia apagar conta estabelecida e todo o histórico financeiro |
| 4 | Alta | ✅ Corrigida | Doações públicas eram aceitas por destinatários sem e-mail verificado |
| 5 | Alta | 🔴 Aberta | Dependências Socket.IO/Engine.IO/ws permitem DoS antes da autenticação |
| 6 | Alta | 🔴 Aberta | Multer 2.0.2 permite DoS no processamento multipart |
| 7 | Alta condicional | 🟡 Condicional | Inexistência de tratamento de MED permite perda financeira repetível |
| 8 | Média | 🟠 Média aberta | Imagens compactadas podem pressionar excessivamente o decoder do Sharp |
| 9 | Média | 🟠 Média aberta | Fila de overlay não tem limite e pode gerar trabalho O(n) e fan-out para R2 |

A auditoria de dependências encontrou 138 advisories no grafo completo (2 Críticas, 48 Altas). A maioria é transitiva de CLI, build ou pontos de consumo não alcançáveis. Apenas os CVEs com caminho de execução real no backend estão reportados abaixo.

---

## 1. ✅ Corrigida — 2FA podia ser contornado e sessões antigas permaneciam válidas

**Severidade:** Alta  
**Confiança:** Alta

### Evidências

- `src/modules/auth/auth.service.ts:313-317`
- `src/modules/account/account.service.ts:64-114`
- `src/modules/account/account.service.ts:123-134`
- `src/modules/account/account.service.ts:151-219`
- `src/modules/withdrawals/withdrawals.service.ts:38-50`
- `src/common/security/step-up.util.ts:19-67`

### Como ocorria

1. O atacante obtinha a senha e uma sessão válida da vítima, inclusive uma sessão criada antes da ativação do 2FA.
2. A ativação do 2FA não revogava sessões existentes.
3. A troca de e-mail exigia apenas a senha e persistia imediatamente o novo endereço com `verifiedEmail=false`.
4. O OTP do novo e-mail chamava `verifyOtp()`, que criava um novo JWT mesmo com `totpEnabled=true`.
5. O atacante podia então trocar a senha e preservar a sessão própria, expulsando a vítima.

O 2FA era aplicado somente no login, não como nível de segurança da sessão. Ações financeiras e de credencial não exigiam reautenticação.

### Impacto

Tomada completa de contas, inclusive administrativas, com acesso a CPF, chaves Pix, carteira, histórico e criação de saques.

### Correção aplicada

- `src/common/security/step-up.util.ts` centraliza a política de step-up.
- E-mail, desativação e criação de saque exigem TOTP quando há 2FA e senha quando não há.
- Troca de senha exige senha atual e TOTP adicional quando o 2FA está ativo.
- Iniciar o 2FA exige a senha atual.
- Ativar o 2FA revoga todas as sessões exceto a atual (`AccountService.enable2fa`).
- `POST /auth/verify-otp` não cria sessão para contas com 2FA; retorna `{ requiresLogin: true }`.
- Alteração de e-mail passou a exigir confirmação por OTP em endpoint autenticado.

### Compatibilidade de API

- `POST /account/2fa/setup` agora recebe `{ password }`.
- `POST /account/email` pode exigir `password` ou `totp`.
- `PATCH /account/password` e `PATCH /account/deactivate` aceitam `totp` quando aplicável.
- `POST /withdrawals` aceita `password` ou `totp`.
- Novo endpoint: `POST /account/email/verify` com `{ otp }`.

---

## 2. ✅ Corrigida — Tokens de recuperação sobreviviam à troca de senha e permitiam replay

**Severidade:** Alta  
**Confiança:** Alta

### Evidências

- `src/modules/auth/auth.service.ts:205-231`
- `src/modules/auth/auth.service.ts:236-263`
- `src/infra/db/repositories/change-password.repositories.ts:9-79`
- `prisma/schema.prisma:254-263`

### Como ocorria

1. O atacante obtinha um token de recuperação válido.
2. A vítima trocava a senha para responder a um comprometimento.
3. `changePassword` não invalidava as linhas pendentes de `change_password`.
4. O token antigo continuava aceito por `POST /auth/reset-password`.
5. O consumo também era separado em `findByToken` → hashing → update → delete, permitindo que duas requisições paralelas legessem o mesmo token antes da exclusão.

### Impacto

Substituição da senha após uma ação de recuperação da vítima e replay paralelo de tokens interceptados.

### Correção aplicada

- `ChangePasswordRepository.replaceForUser` substitui o token anterior do usuário em transação.
- `existsValidToken` faz rejeição barata antes do bcrypt em requisições inválidas.
- `consumeTokenAndUpdatePassword` executa `DELETE ... RETURNING` atômico; apenas uma requisição consegue consumir o token.
- Troca de senha e confirmação de e-mail invalidam recovery tokens na mesma transação da credencial.
- A tabela `change_password` foi mantida no Postgres; a migração para Redis ficou adiada.

---

## 3. ✅ Corrigida — Cleanup podia apagar conta estabelecida e histórico financeiro

**Severidade:** Alta  
**Confiança:** Alta

### Evidências

- `src/modules/auth/auth-cleanup.service.ts:11-20`
- `src/infra/db/repositories/users.repositories.ts:135-149`
- `src/modules/account/account.service.ts:64-114`
- `prisma/schema.prisma:120-238`

### Como ocorria

1. Uma conta estabelecida solicitava alteração de e-mail.
2. O endereço era persistido imediatamente com `verifiedEmail=false`, sem alterar `createdAt`.
3. O job de cleanup selecionava `verifiedEmail=false AND createdAt < now-15min`.
4. A conta estabelecida era confundida com um registro abandonado e sofria exclusão definitiva (hard delete).
5. `onDelete: Cascade` removia wallet, ledger, Pix keys, doações, saques, widgets e configurações.

### Impacto

Perda irreversível de saldo, ledger, histórico, saques em andamento e capacidade de reconciliação.

### Correção aplicada

- O e-mail atual permanece válido e verificado durante a mudança.
- `PATCH /account/email` cria apenas uma pendência `email:change:<userId>` no Redis.
- O novo endereço só é persistido em `POST /account/email/verify`.
- O e-mail anterior continua sendo a identidade válida se o OTP não for confirmado.
- `deleteManyUnverified` passou a excluir somente contas sem doações, saques, transações ou chaves Pix, como defesa em profundidade.

---

## 4. ✅ Corrigida — Doações públicas eram aceitas por destinatários sem e-mail verificado

**Severidade:** Alta  
**Confiança:** Alta

### Evidências

- `src/modules/donations/donations.service.ts:71-78`
- `src/modules/donations/donations.service.ts:99-180`
- `src/modules/donations/donations.controller.ts:61-87`
- `src/modules/donations/donations.service.ts:291-307`
- `src/modules/auth/auth.service.ts:88-106`

### Como ocorria

1. Uma conta era registrada e permanecia `active=true` mesmo sem confirmar o e-mail.
2. A descoberta pública e `POST /donations/donation` verificavam apenas `active`.
3. A conta não verificada podia receber e liquidar doações.
4. O cleanup posterior removia a conta e o ledger; pagamento atrasado também não encontrava a doação e não possuía caminho de reembolso.

### Impacto

Doadores podiam ser cobrados sem crédito recuperável e a plataforma perdia a trilha financeira da operação.

### Correção aplicada

- `getUser` e `donation` agora exigem `user.verifiedEmail`.
- Destinatários não verificados desaparecem da descoberta e não podem receber novas cobranças.
- Doações já criadas antes da correção continuam elegíveis para crédito.

---

## 5. 🔴 Aberta — Dependências Socket.IO/Engine.IO/ws permitem DoS antes da autenticação

**Severidade:** Alta  
**Confiança:** Alta

### Versões instaladas

- `engine.io@6.6.6` — `pnpm-lock.yaml:2663-2665`, `pnpm-lock.yaml:7696-7707`
- `socket.io-parser@4.2.5` — `pnpm-lock.yaml:4176-4178`, `pnpm-lock.yaml:9475-9490`
- `ws@8.18.3` — `pnpm-lock.yaml:4624-4638`, `pnpm-lock.yaml:9468-9469`

### CVEs alcançáveis

| CVE | Efeito |
|---|---|
| `CVE-2026-59725` | Resposta de polling inválida não é fechada; conexões HTTP/sockets são retidas |
| `CVE-2026-33151` / `CVE-2026-69185` | Número descontrolado de anexos Socket.IO é armazenado em memória |
| `CVE-2026-48779` | Fragmentos WebSocket muito pequenos forçam alocações de memória acima do limite de payload |

### Como ocorre

- `src/main.ts:64` sobe o servidor HTTP com os gateways no mesmo processo.
- `src/infra/websocket/overlay.gateway.ts:16-42` e `src/infra/websocket/dashboard.gateway.ts:19-50` autenticam apenas depois que a conexão de transporte/namespace é estabelecida.
- O `ThrottlerGuard` global é aplicado a rotas HTTP e não protege `/socket.io/*`.
- Polling e WebSocket são transportes habilitados pelo Engine.IO instalado.

O atacante pode abrir sessões de polling, enviar POST binário inválido, declarar uma quantidade elevada de anexos ou transmitir fragmentos pequenos, sem token válido.

### Impacto

Esgotamento de sockets, descritores, conexões HTTP e memória do processo. A indisponibilidade afeta API, gateways e workers BullMQ.

### Correção recomendada

- Atualizar para `engine.io>=6.6.7`, `socket.io-parser>=4.2.7` e `ws>=8.21.0`.
- Atualizar o lockfile e validar a resolução efetiva.
- Até a atualização, limitar conexões, requisições e tempo em `/socket.io/*` no proxy/LB.

---

## 6. 🔴 Aberta — Multer 2.0.2 permite DoS no processamento multipart

**Severidade:** Alta  
**Confiança:** Alta

### Versão instalada

- `multer@2.0.2` — `pnpm-lock.yaml:3623-3625`, `pnpm-lock.yaml:8898-8906`

### CVEs aplicáveis

- `CVE-2026-2359` e `CVE-2026-3304`: limpeza/cancelamento incompleto de recursos multipart.
- `CVE-2026-3520`: recursão não controlada no parser.
- `CVE-2026-5079`: nomes de campos com aninhamento profundo.
- `CVE-2026-77078`: `RangeError` não tratado em nomes de campo.
- `CVE-2026-82333`: índice de array forjado para exaustão de iterações/event loop.

### Rotas alcançáveis

- `PUT /profile/photo` — `src/modules/profile/profile.controller.ts:58-85`
- `POST /admin/voices` e `PATCH /admin/voices/:id` — `src/modules/admin/controllers/admin-voices.controller.ts:54-93`

Os interceptors definem apenas `fileSize`. Campos textuais, número de parts, profundidade de nomes e índices não são limitados. O parser executa antes do DTO e da validação da imagem.

### Como ocorre

Um usuário comum cria uma conta, obtém uma sessão e envia multipart malformado para `PUT /profile/photo`. O problema é explorado antes das regras de negócio.

### Impacto

Crash por stack overflow, exaustão de CPU/memória e bloqueio dos workers. A rota de perfil torna a falha alcançável por qualquer conta autenticada; as rotas de voz exigem admin.

### Correção recomendada

Substituir o `multer@2.0.2` fixado pelo Nest por versão corrigida e configurar limites de `fields`, `parts`, profundidade e índices. A atualização deve ser feita por override explícito no lockfile, pois um refresh simples pode manter a versão fixada pelo pacote do Nest.

---

## 7. 🟡 Condicional — Inexistência de tratamento de MED permite perda financeira repetível

**Severidade:** Alta condicional  
**Confiança:** Alta para o controle ausente; média para a perda externa

### Evidências

- `src/modules/webhooks/webhooks.controller.ts:31-82` — somente processa `POST /webhook/pix` e `body.pix`.
- `src/infra/gateway/contract/gateway.contract.ts:6-25` — não existe operação MED.
- `src/infra/gateway/Efi/efi.service.ts:40-240` — só cobre cobrança recebida e Pix enviado.
- `prisma/schema.prisma:14-20` — `DonationStatus` não possui `disputed` ou `refunded`.
- `prisma/schema.prisma:125` — `Wallet.blockedBalance` existe.
- `src/infra/db/repositories/wallets.repositories.ts:139-148` — `applyOp` não movimenta `blockedBalance`.
- `docs/plans/2026-08-12-med-and-fee-ledger.md:35-43` — lacuna já mapeada em plan, ainda sem implementação.

### Como ocorreria

1. O doador paga uma doação e a carteira do streamer é creditada.
2. O streamer solicita e recebe o saque.
3. O doador abre um MED contra o Pix original e a devolução é aceita externamente.
4. O backend não recebe o evento, não cria reversão no ledger e não bloqueia saques.
5. O doador recupera o valor original enquanto o streamer mantém o saque.

Repetir o ciclo retira recursos da conta de settlement da plataforma.

### Condição externa

A aceitação do MED depende do fluxo Efí/banco. O repositório não demonstra que o backend possa aceitar um MED; a ausência de ingestão, estado, reversão e déficit é que está confirmada. A implementação do contrato MED ainda precisa ser validada com a Efí.

### Correção recomendada

Implementar o plano já existente: webhook MED autenticado, estado idempotente de disputa, reversão no ledger, uso de `blockedBalance` para déficit e bloqueio de saques enquanto houver saldo bloqueado.

---

## 8. 🟠 Média aberta — Pressão de memória no decoder de imagens

**Severidade:** Média  
**Confiança:** Média-alta

### Evidências

- `src/modules/profile/profile.controller.ts:58-85` — limite de 2 MiB por arquivo.
- `src/modules/profile/profile.service.ts:144-169` — valida MIME/tamanho comprimido, mas não define `limitInputPixels`.
- `src/modules/profile/profile.service.ts:158-165` — o Sharp decodifica antes do resize.
- `package.json:67` — Sharp 0.35.4.
- O padrão do Sharp é `limitInputPixels=268402689`; uma imagem extremamente comprimida próxima desse teto pode exigir centenas de MiB a 1 GiB de memória nativa.

### Como ocorre

Uma conta autenticada envia PNG/WebP sólido com dimensões muito grandes e arquivo comprimido abaixo de 2 MiB. Várias requisições exercitam o decoder antes do resize para 512 px.

### Por que não é Alta

O Sharp possui limite padrão de pixels e o endpoint tem throttle de 10/min. O risco real depende do comportamento do decoder, formato e limite de memória do processo/container.

### Correção recomendada

Passar `limitInputPixels` explícito e baixo para as duas pipelines de imagem e adicionar limite de concorrência somente se as medições mostrarem necessidade.

---

## 9. 🟠 Média aberta — Fila de overlay sem limite gera trabalho O(n) e fan-out para R2

**Severidade:** Média  
**Confiança:** Alta para o mecanismo; Média para o impacto agregado

### Evidências

- `src/modules/widgets/overlay.controller.ts:13-17` — `POST /overlay/test`.
- `src/modules/widgets/overlay.controller.ts:46-55` — `POST /overlay/replay/:donationId`.
- `src/modules/widgets/overlay.service.ts:248-287` — enfileira sem deduplicação ou limite de tamanho.
- `src/modules/widgets/overlay.service.ts:459-510` — lê e processa a fila inteira.
- `src/infra/redis/redis.service.ts:85-113` — `RPUSH` e `LRANGE 0 -1` sem cap.
- `src/modules/widgets/overlay.service.ts:378-405` — resolve áudio com `HeadObject` no R2.
- `src/modules/widgets/overlay.service.ts:486-493` — um `Promise.all` por entrada.

### Como ocorre

Uma conta chama repetidamente `replay` com a mesma doação paga ou `test`. Duplicatas permanecem na lista Redis sem TTL. A cada nova entrada, a sincronização lê toda a fila, monta payloads, consulta ids no banco e pode disparar um `HeadObject` no R2 por duplicata.

### Impacto

Crescimento permanente de memória Redis, consultas com `IN` muito grandes, rajadas de requisições R2 e payloads WebSocket excessivos. O throttle limita a taxa, mas não o tamanho acumulado nem o trabalho por requisição.

### Correção recomendada

- Aplicar limite atômico por fila/widget no enqueue.
- Deduplicar replay quando a mesma doação já está pendente.
- Tornar a sincronização do dashboard limitada/paginada.
- Evitar um `HeadObject` por duplicata, usando cache ou resolução em lote.

---

## CVEs e riscos não reportados como vulnerabilidades

### Handlebars 4.7.8 — Crítica, não alcançável

- Versão: `pnpm-lock.yaml:3055`, `pnpm-lock.yaml:8171`.
- `src/infra/queues/email/email.processor.ts:27-35` compila apenas templates locais, lendo `source` de arquivos do repositório.
- `templateName` possui conjunto fechado de valores; dados de usuário entram apenas como contexto escapado.
- Não há AST, partial, decorator ou template string controlada por request.

### protobufjs 7.5.4 — Crítica, não alcançável

- Versão: `pnpm-lock.yaml:3946`, `pnpm-lock.yaml:9206`.
- O caminho usado por `@google/genai` faz chamadas JSON; a aplicação não carrega schema ou descriptor protobuf controlado por atacante.
- O CVE exige controle sobre a definição/descriptor carregado pelas APIs de reflexão.

### Dependências de CLI/build

Hono, `@hono/node-server`, effect, defu, deepmerge-ts, mysql2, brace-expansion, lodash e js-yaml foram encontrados em caminhos de Prisma CLI, Swagger ou rotinas sem entrada não confiável. Não são pontos de consumo alcançáveis no runtime NestJS atual.

### fast-xml-parser via R2

O AWS SDK alcançaria um parser XML vulnerável, mas o atacante precisaria controlar a resposta do endpoint R2. Isso depende de R2 comprometido, interceptação TLS ou configuração insegura; não foi classificado como vulnerabilidade de aplicação incondicionalmente.

## Residuais já documentados, não duplicados

- WebSocket sem throttling (`docs/security.md:46`).
- WebSockets `/dashboard` já conectados permanecem ativos até desconectar, mesmo após revogação da sessão (`docs/security.md:25`).
- CORS, segredo estático do webhook, exposição de chaves Pix e demais itens já cobertos pelos audits existentes foram removidos deste relatório.

## Ordem recomendada de correção

1. Atualizar o grafo Socket.IO/Engine.IO/ws.
2. Substituir Multer 2.0.2 e limitar multipart.
3. Confirmar o contrato MED com a Efí e implementar o plano de disputas.
4. Adicionar limite explícito de pixels ao Sharp.
5. Limitar e paginar a fila de overlay.

## Verificação executada

- `pnpm audit --prod --audit-level high`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- Revisão adversarial read-only do diff implementado; os problemas encontrados foram corrigidos e a segunda revisão não apontou falhas restantes.
