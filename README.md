<p align="center">
  <img src="/readme-assets/logo.png" alt="Logo LinkPix" />
</p>

<p align="center">
  Plataforma de doações para streamers com pagamento via Pix, alertas em tempo real, moderação por IA e mensagens em voz (TTS).
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/Prisma-7.4-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-FF4438?logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Socket.IO-010101?logo=socket.io&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/BullMQ-C9292A?logo=bullmq&logoColor=white" alt="BullMQ" />
  <img src="https://img.shields.io/badge/License-UNLICENSED-lightgrey" alt="License" />
</p>

## 📝 Sobre o Projeto

O **LinkPix** é uma plataforma de doações ao vivo, para que espectadores possam apoiar seus streamers favoritos com doações via Pix. Cada contribuição pode incluir uma mensagem de texto ou voz exibida durante a transmissão. Uma forma simples e divertida de fortalecer a conexão entre criador e audiência.

## 💡 Funcionalidades

- 🔐 **Autenticação Segura:** Registro e login com gerenciamento de multi-sessão (JWT + Redis), recuperação de senha e verificação de e-mail via OTP.
- 💸 **Doações via Pix:** Geração dinâmica de QR Code Pix com tempo de expiração e integração com Webhooks automáticos para confirmação imediata de pagamento.
- 🤖 **Moderação por IA:** Filtro automatizado de spam e toxicidade usando Google Gemini antes que a mensagem seja processada.
- 🗣️ **Text-to-Speech (TTS):** Síntese de voz via Google Cloud TTS para leitura em tempo real das mensagens enviadas pelos doadores.
- ⚡ **Overlay em Tempo Real:** Conexão estável via WebSockets (Socket.IO) para exibição instantânea de alertas e animações na tela do streamer.
- 📊 **Dashboard Completo:** Painel de controle com geração de estatísticas de receita e histórico detalhado de doações.
- 🧮 **Gestão de Carteira:** Controle financeiro preciso dividindo os saldos do usuário em: _disponível_, _pendente_ e _bloqueado_.
- 🏧 **Fluxo de Saques:** Solicitação de saques via Pix com cálculo de taxa configurável e sistema de aprovação manual por administradores.
- 🔒 **Segurança de Chaves Pix:** Gerenciamento de chaves Pix com criptografia robusta.
- 🎛️ **Customização de Widgets:** Configuração completa do overlay (ajuste de volume, escolha de voz, cores, tamanho e controle de pausa de alertas).
- 👑 **Painel Administrativo:** Área restrita para gerenciamento global da plataforma e aprovação/rejeição de saques solicitados.
- 🐂 **Filas e Resiliência:** Processamento em segundo plano para garantir o disparo de e-mails e eventos de doação sem travar a aplicação.

## 💻 Tecnologias usadas

- 🦅 **NestJS** — Framework modular focado em escalabilidade, injeção de dependência e arquitetura limpa.
- 📘 **TypeScript** — Superset que adiciona tipagem estática forte, prevenindo erros em desenvolvimento.
- ⬢ **Prisma ORM** — Ecossistema moderno para modelagem de dados, migrações seguras e consultas eficientes.
- 🐘 **PostgreSQL** — Banco de dados relacional (SQL) robusto, garantindo integridade e consistência dos dados.
- 🟥 **Redis** — Armazenamento em memória de alto desempenho, utilizado para cache e gestão de sessões.
- 🐂 **BullMQ** — Gerenciamento de filas robusto para processamento assíncrono.
- ⚡ **Socket.IO** — Comunicação bidirecional e eventos em tempo real através de conexões WebSocket.
- 💵 **Efí Pay** — Gateway financeiro para recebimento e saque automatizado via Pix.
- ♊ **Google Gemini** — Inteligência artificial integrada para análise e moderação automatizada de mensagens.
- 🗣️ **Google Cloud TTS** — Conversão avançada de texto em fala para síntese de voz em tempo real.
- 🧡 **Cloudflare R2** — Armazenamento de alta performance, compatível com a API S3.
- ✉️ **Resend** — Infraestrutura otimizada para o disparo transacional de e-mails.
- 📑 **Swagger** — Geração automatizada da documentação interativa dos endpoints e contratos da API.

## 🏗️ Arquitetura

O projeto segue os princípios de **Arquitetura Limpa** e **Arquitetura Hexagonal**, utilizando Inversão de Dependência (DIP) para garantir a separação de responsabilidades em camadas:

<p align="center">
  <img src="/readme-assets/architecture.png" alt="Arquitetura LinkPix" />
</p>

#### 🚫 Diretrizes das Camadas

- **Controller**: Ponto de entrada da requisição, valida payloads via DTOs e delega a execução ao Service. _Não deve conter regras de negócio._
- **Service**: O cérebro do sistema. Centraliza as regras de negócio e orquestra os fluxos. _Não deve acessar o banco ou provedores externos diretamente, comunicando-se apenas através de Repositories e Contracts._
- **Repository**: Responsável exclusivamente pela persistência e manipulações diretas no banco de dados via Prisma. _Não deve conter regras de negócio ou chamar serviços externos._
- **Contract**: Define as interfaces abstratas para o consumo de serviços externos. _Não deve implementar lógica e nem vazar tipos específicos de bibliotecas terceiras para o resto do sistema._

## 🔀 Pipeline de Doação

O fluxo completo de processamento de uma doação é **assíncrono**:

1. **Ação do Usuário:** O espectador interage com a página do streamer, insere seus dados e gera um QR Code Pix dinâmico.
2. **Confirmação:** Assim que o pagamento é concluído, o gateway envia um Webhook para a API. A requisição é imediatamente enfileirada no **BullMQ**, liberando o gateway de pagamento sem travar o servidor com processamentos pesados.
3. **Processamento em Background:** O worker do BullMQ consome a tarefa e executa os serviços de forma sequencial:
   - **Moderação:** Valida o texto com a API do **Google Gemini** (filtro de spam/toxicidade).
   - **Conversão de Áudio:** Envia o texto aprovado para o **Google Cloud TTS** gerar o arquivo de fala.
   - **Persistência:** Atualiza os dados no banco de dados via Prisma.
4. **Organização:** O evento é estruturado de forma cronológica no **Redis** para garantir que os alertas da live sejam processados na ordem correta, sem sobreposição de áudios ou perda de mensagens.
5. **Exibição na Live:** Através do **Socket.IO (WebSockets)**, o backend emite o evento para o frontend do Overlay. O alerta visual e o áudio sintetizado são reproduzidos instantaneamente na transmissão do streamer.

<p align="center">
  <img src="/readme-assets/diagram-tts.png" alt="Logo LinkPix" />
</p>

## 📂 Estrutura do Projeto

```text
├── prisma/                  # Configurações do Prisma ORM (Schema e Migrations)
│   └── schema.prisma        # Definição dos modelos de dados do banco
│
├── src/
│   ├── common/              # Recursos globais compartilhados (Guards, Decorators, Filters, Pipes)
│   │   ├── config/          # Configurações globais e validação de variáveis de ambiente
│   │   └── dto/             # DTOs globais reutilizáveis (ex: paginação)
│   │
│   ├── infra/               # Implementações físicas e acoplamentos externos
│   │   ├── ai/              # Integração com Google Gemini (Moderação)
│   │   ├── db/              # Camada de Persistência (Prisma Service & Repositories)
│   │   ├── gateway/         # Gateway de Pagamentos (Efí Pay Pix)
│   │   ├── queues/          # Filas de processamento com BullMQ (Donations / Emails)
│   │   ├── speech/          # Síntese de Voz com Google Cloud TTS
│   │   ├── storage/         # Armazenamento de arquivos com Cloudflare R2
│   │   └── websocket/       # Gateways de comunicação em tempo real (Socket.IO)
│   │
│   ├── modules/             # Casos de uso e domínios de negócio (Controllers & Services)
│   │   ├── auth/            # Autenticação (Guards e sessões em cache)
│   │   ├── donations/       # Ciclo de vida e webhooks de doações
│   │   ├── wallets/         # Gestão de saldos e carteiras financeiras
│   │   ├── widgets/         # Manipulação de componentes em tempo real (Overlay)
│   │   └── admin/ dashboard/ pix-keys/ withdrawals/
│   │
│   ├── templates/emails/    # Templates HTML de e-mails usando Handlebars
│   ├── app.module.ts        # Módulo raiz da aplicação
│   └── main.ts              # Ponto de entrada (Configurações globais de CORS, Helmet, Swagger)
│
├── AGENTS.md                # Instruções de contexto e diretrizes para IAs
└── package.json             # Metadados, comandos e pacotes usados no projeto
```

## 🗄️ Modelo de Dados (Database Schema)

O banco de dados relacional é mapeado através do Prisma ORM e conta com **10 modelos** principais e **8 enums**, estruturados para garantir a integridade financeira e o histórico de auditoria:

```text
               ┌── (1) Wallet (Saldos e Controle)
               ├── (1) DonationSettings (Customização do Streamer)
User (Streamer)┤
               ├── (N) PixKey (Chaves de Destino para Saques)
               ├── (N) Donation (Mensagens e Histórico de Recebidos)
               ├── (N) Withdrawal (Fluxo de Solicitação de Resgates)
               ├── (N) Transaction (Lançamentos de Débito e Crédito)
               ├── (N) Widget (Configuração de Overlays da Stream)
               └── (N) ChangePassword (Tokens e Segurança de Senha)
```

## 📑 Documentação da API (Swagger)

A API possui uma documentação interativa e totalmente tipada utilizando o padrão **OpenAPI / Swagger**. Nela, você encontrará todos os endpoints, esquemas de validação (DTOs) e códigos de resposta.

- **Acesso Local:** `http://localhost:3000/api/docs` _(disponível apenas em ambiente de desenvolvimento)_

#### 🚀 Principais Grupos de Endpoints

Para facilitar a navegação no Swagger, as rotas estão organizadas por contextos de domínio:

- 🔑 `/auth` — Fluxos de autenticação, renovação de tokens e gerenciamento de sessões via Redis.
- 💸 `/donations` — Geração e processamento de doações via Pix e recepção de webhooks.
- 🏧 `/withdrawals` & `/wallets` — Solicitações de saques e verificação de saldos em carteira.
- 🎛️ `/widgets` & `/donation-settings` — Customização do overlay em tempo real da stream.
- 👑 `/admin` — Controle de privilégios e auditoria/aprovação manual de saques.

## ⚙️ Configuração e Instalação

#### 📋 Pré-requisitos

Antes de iniciar, certifique-se de ter instalado e configurado em sua máquina:
* **Ambiente:** [Node.js 22+](https://nodejs.org/), [pnpm](https://pnpm.io/), [PostgreSQL](https://www.postgresql.org/) e [Redis](https://redis.io/) (Instalação manual ou Docker)
* **Credenciais Externas:** Efí Pay (Pix SDK), Google AI Studio (Gemini), Google Cloud (TTS), Cloudflare R2 e Resend.

#### 🚀 Comandos para Execução

```bash
# 1. Clone o repositório e acesse a pasta
git clone https://github.com/linkpixlive/api.git
cd api

# 2. Instale as dependências
pnpm install

# 3. Configure as variáveis de ambiente (edite o arquivo .env gerado)
cp .env.example .env

# 4. Execute as migrations para estruturar o banco de dados
pnpm run db:migrate

# 5. Inicie o servidor em modo de desenvolvimento
pnpm start:dev
```

## 🪪 Licença

UNLICENSED — Projeto privado.
