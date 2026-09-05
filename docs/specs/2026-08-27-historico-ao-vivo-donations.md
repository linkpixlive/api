# Spec — Histórico + Ao Vivo (página única) com fila Redis preservada

**Date:** 2026-08-27
**Status:** ready-for-agent
**Tracker:** local (GitHub `linkpixlive/api` quando `gh` disponível)
**Project:** `linkpix-frontend` + `tipply-backend` — Dashboard histórico + overlay fila

---

## Problem Statement

Streamers não têm onde ver o histórico de doações pagas. A única página existente mostra a fila em tempo real vinda do Redis, que fica vazia na maior parte do tempo (3–5 doações simultâneas no pico) e duplica após refresh — o mesmo `id` aparece pendente no Redis e `paid` no banco. Não há distinção visual entre "offline não enfileira (só replay manual)" vs "pausado enfileira (toca ao retomar)", nem lista ordenada fixa por chegada. Pausar, limpar e teste têm efeitos diferentes na fila e no histórico que não estão comunicados.

## Solution

Uma página única no dashboard com **Ao Vivo** no topo (o que está tocando agora no overlay) e **Histórico** paginado abaixo. O banco é a verdade do histórico, o Redis continua a verdade da fila. O websocket do dashboard passa a emitir tanto o estado da fila quanto os eventos do histórico. O histórico mostra apenas dois estados na UI — **Não exibido** e **Exibido** — ordenado por chegada (mais nova em cima, imutável). Doações não confirmadas não entram na lista. Limpar a fila só limpa o Redis e notifica, teste nunca entra no histórico, replay reinsere o mesmo `id` na fila mantendo o status original.

## User Stories

1. Como streamer, quero ver em uma página só o que está tocando agora e meu histórico de doações, para não trocar de aba durante a live.
2. Como streamer, quero que o Ao Vivo mostre o alerta atual em destaque quando houver um tocando, para saber o que minha audiência vê no OBS.
3. Como streamer, quando nada está tocando, quero ver "Tudo tranquilo" no Ao Vivo, para ter certeza que não há nada em flight.
4. Como streamer, quero ver meu histórico ordenado por chegada com a mais nova em cima, imutável, para ter ordem cronológica previsível.
5. Como streamer, quero que replay não reordene a lista, para a lista permanecer como log e a re-execução ir só para a fila.
6. Como streamer, quero filtrar histórico por "Não exibido / Exibido", para achar quem ainda vai tocar.
7. Como streamer, quero paginar o histórico, para navegar em muitas doações sem travar.
8. Como streamer, quero que doações pendentes, falhadas ou expiradas não apareçam, para ver só doações confirmadas.
9. Como streamer, quero que doações recebidas com overlay offline apareçam no histórico como "Não exibido" mas não entrem na fila, para decidir manualmente se dou replay.
10. Como streamer, quero que doações recebidas com fila pausada apareçam como "Não exibido" e entrem na fila empilhando, para tocarem ao retomar em ordem.
11. Como streamer, quero ver badge Online/Offline e Ativo/Pausado sempre visível, para entender por que a fila não avança.
12. Como streamer, quero pausar e retomar a fila sem perder a ordem, para segurar alertas temporariamente.
13. Como streamer, quero pular o alerta atual (quando ativo) e remover o próximo da fila (quando pausado), com feedback distinto.
14. Como streamer, quero limpar a fila e ver só notificação "Fila limpa", sem apagar linhas do histórico, pois pagou tem que permanecer.
15. Como streamer, quero que alerta de teste nunca entre no histórico, mas siga a fila em ordem de chegada, para não poluir o financeiro.
16. Como streamer, quero dar replay em qualquer linha do histórico pelo mesmo identificador mantendo o status original, para re-exibir sem duplicar histórico.
17. Como streamer, quero que replay de offline e de pausado funcione igual, enfileirando ao final da fila.
18. Como streamer, quero que nova doação paga entre no topo do histórico como "Não exibido" em tempo real via websocket, sem refresh.
19. Como streamer, quando a doação terminar no overlay, quero que a mesma linha vire "Exibido" em tempo real.
20. Como streamer, quero que refresh não duplique a mesma doação, para não achar que recebi dobrado.
21. Como streamer, quero abrir o controle em popup minimalista só com Ao Vivo, para monitorar em segundo monitor.
22. Como streamer, quero que a URL preserve paginação e filtros, para compartilhar posição do histórico.
23. Como streamer pausado com pendentes, quero ver "Próximos na fila" expandido, para saber quem vai tocar ao retomar.
24. Como streamer offline com pendentes, quero ver CTA "Ver como conectar" no banner, para reconectar o overlay.
25. Como streamer, quero que a página siga o design system (cards arredondados, chips pill, tipografia Satoshi), para consistência com Carteira.

## Implementation Decisions

- **Módulos afetados:** Dashboard (histórico), Widgets/Overlay (fila), Webhooks e fila de doações (pagamento → pago), Infra Websocket (gateways), Infra Redis (fila).
- **Histórico fonte única banco:** o endpoint de histórico já filtra apenas pagos e exibidos e retorna paginado; a UI mapeia pago para "Não exibido" e exibido para "Exibido" e esconde pendentes, falhados e expirados. Ordenação fixa por data de criação decrescente, sem reordenar em replay ou ao virar exibido.
- **Fila fonte única Redis:** chaves de overlay, fila e alerta atual permanecem idênticas; regra de offline não enfileirar e pausado enfileirar preservadas. O disparo do próximo alerta continua bloqueado quando pausado ou quando já há alerta em voo.
- **Websocket do dashboard passa a emitir dois tipos:** mantém o estado da fila e o estado do overlay vindos do Redis para o Ao Vivo, e adiciona eventos de criação e atualização de doação vindos do banco para o histórico. Ações de limpar, pular, pausar e teste continuam emitindo só estado da fila mais notificação.
- **Comportamentos confirmados:** limpar zera fila e alerta atual sem tocar no banco; teste entra na fila Redis como entrada sintética e seu término não marca exibido no banco; replay reinsere o mesmo identificador na fila Redis mantendo o status original no banco; lista do histórico nunca reordena.
- **Infra e padrões:** segue a arquitetura em camadas (Controller → Service → Repository/Contract), repositórios como único acesso a Prisma com transações para operações financeiras, contratos para gateway, TTS e storage, `RedisService` como única abstração de Redis, eventos em `snake_case` com throttling, sem construção manual de envelope de resposta.

## Testing Decisions

- **O que é bom teste:** só comportamento externo — dada resposta de rede, o que renderiza; dada ação do usuário, qual request ou evento sai com qual payload; dado evento de websocket, como a linha muda de chip. Sem asserts em estado interno ou hooks.
- **Seams a testar:** (1) borda HTTP com interceptação de rede para histórico e overlay renderizando a página real via router; (2) borda de websocket mockando cliente socket para estado da fila e eventos de histórico, estado do overlay, nova doação, término de alerta e heartbeat. Um seam só de HTTP é insuficiente porque offline e pausado só são observáveis via websocket.
- **Módulos sob teste:** página única (loader com paginação, chips, paginação, estados vazio e carregando), criação de doação insere topo como Não exibido, atualização vira Exibido na mesma linha, limpar zera fila mas mantém histórico e mostra toast, teste não entra, replay enfileira mesmo id, offline pago não enfileira vs pausado enfileira, término de alerta marca exibido.
- **Prior art:** skill de integração de account-settings usou MSW na borda HTTP com loader e action reais; `vitest` com `jsdom`, `@testing-library/react` e `msw` já instalados mas sem testes de fila e histórico — este será o segundo conjunto seguindo o mesmo padrão.

## Out of Scope

- Mudar enum de status de doação ou criar novo status de cancelado; manter pendente, pago, exibido, falhado e expirado.
- Persistir flag de enfileirado no banco; distinção offline versus pausado continua via Redis.
- Reordenar histórico por status ou por replay; lista fixa por chegada.
- Exibir histórico de pendentes, falhados ou expirados na lista.
- Mudanças em configurações de widgets além de pausado já existente.
- Exclusão permanente de conta, códigos de backup de 2FA, listagem de sessões ativas.

## Further Notes

- Vocabulário segue o backend: streamer, overlay, fila, pago, exibido, término de alerta, pulso de heartbeat.
- Após este spec em `ready-for-agent`, gerar tipos OpenAPI para histórico com filtro opcional de status e decidir se replay de exibido deve permitir múltiplos replays seguidos sem intervalo.
