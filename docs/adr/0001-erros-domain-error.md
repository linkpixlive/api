# 0001 — Fronteira de erros: `DomainError` nos repositories, `HttpException` nos services

- **Status:** accepted
- **Data:** 2026-09-22

## Contexto

O envelope global (`GlobalExceptionFilter` → `{ success: false, error: { message, code } }`) aceita duas origens de erro, mas os docs divergiam sobre quem pode lançar o quê: o invariante do `AGENTS.md` manda "lance `HttpException`", `architecture.md` admitia `HttpException` em guardas de repository, e a auditoria de wallet marcou repository lançando `HttpException` como achado (e corrigiu no `applyOp`). A regra praticada no código é a descrita aqui.

## Decisão

- **Repositories** (`infra/db/repositories/`) lançam **erros de domínio**: classes em `src/common/errors/*.errors.ts` estendendo `DomainError` (`message` + `status` HTTP). Ex.: `WalletNotFoundError` (404), `InsufficientBalanceError` (400), `DonationAlreadyProcessedError` (409). Repository nunca importa nada de `@nestjs/common`.
- **Services/controllers** lançam **`HttpException`** (`BadRequestException`, `NotFoundException`, etc.) e traduzem `DomainError` quando precisam de mensagem de outro contexto (ex.: `WithdrawalsService.create` mapeia erros do `applyOp`).
- **`GlobalExceptionFilter`** mapeia ambos para o mesmo envelope (`HttpException` → `getStatus()`; `DomainError` → `exception.status`; resto → 500).

## Consequências

- Camada de persistência testável sem Nest e sem vazar semântica HTTP para dentro de `$transaction` (erros de domínio sobrevivem a rollback/retry sem carregar `getResponse()`).
- Preço: dois vocabulários de erro para aprender; erro novo de repository exige classe em `*.errors.ts` em vez de `throw new BadRequestException` inline.

## Divergências a alinhar (follow-up, não parte da decisão)

- `AGENTS.md` ("lance `HttpException`") e `architecture.md` ("repos podem lançar `HttpException` em guardas") precisam citar esta fronteira.
