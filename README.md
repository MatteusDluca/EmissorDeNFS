# NFS-e Emissor Simplificado

[![CI Pipeline](https://github.com/MatteusDluca/EmissorDeNFS/actions/workflows/ci.yml/badge.svg)](https://github.com/MatteusDluca/EmissorDeNFS/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://www.docker.com/)

> Sistema **Full-Stack** de emissão de Nota Fiscal de Serviço eletrônica (NFS-e) com processamento assíncrono via filas, mock da prefeitura, criptografia de certificados digitais A1 e dashboard analítico com KPIs em tempo real.

**Desenvolvido por:** Matteus Dluca

---

## Índice

- [Arquitetura](#arquitetura)
- [Stack Tecnológica](#stack-tecnológica)
- [Como Rodar Localmente](#como-rodar-localmente)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Endpoints da API](#endpoints-da-api)
- [Fluxo de Emissão de NFS-e](#fluxo-de-emissão-de-nfs-e)
- [Frontend e Dashboard](#frontend-e-dashboard)
- [Segurança](#segurança)
- [Testes Automatizados](#testes-automatizados)
- [Integração Webhook + N8n + Telegram (Bônus)](#integração-webhook--n8n--telegram-bônus)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Trade-offs e Decisões Técnicas](#trade-offs-e-decisões-técnicas)
- [Uso de IA e Ferramentas](#uso-de-ia-e-ferramentas)
- [Limitações Conhecidas](#limitações-conhecidas)
- [Demonstração em Vídeo (Plano B)](#demonstração-em-vídeo-plano-b)
- [Contato](#contato)

---

## Arquitetura

O sistema segue uma arquitetura de **microsserviços**, onde cada componente tem responsabilidade única e se comunica via filas (BullMQ) e HTTP:

```
┌─────────────┐     ┌───────────┐     ┌─────────────┐     ┌──────────────────────┐
│  React SPA  │────▶│   Nginx   │────▶│  API NestJS │────▶│ PostgreSQL 16        │
│  (Vite)     │     │  (Proxy)  │     │  (REST)     │     │ (Prisma ORM)         │
└─────────────┘     └───────────┘     └─────────────┘     └──────────────────────┘
                                            │                        │
                                            ▼                        │
                                      ┌───────────┐                  │
                                      │  BullMQ   │◀─────────────────┘
                                      │  (Redis)  │
                                      └───────────┘
                                            │
                                            ▼
                                      ┌───────────┐     ┌──────────────────────┐
                                      │  Worker   │────▶│  Prefeitura Mock     │
                                      │  (NestJS) │     │  (70% OK / 30% Erro) │
                                      └───────────┘     └──────────────────────┘
                                            │
                                            ▼ (somente em sucesso)
                                      ┌───────────┐     ┌──────────────────────┐
                                      │  Webhook  │────▶│  N8n → Telegram      │
                                      └───────────┘     │  (Notificação)       │
                                                        └──────────────────────┘
```

**Decisão de Design:** A separação entre API e Worker garante que a emissão de notas nunca bloqueia a interface do usuário. O Worker opera de forma *headless* (sem servidor HTTP) e consome jobs da fila de forma independente.

---

## Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Frontend** | Vite + React 19 + Tailwind CSS v4 + Shadcn/ui | UI moderna, performática e componentes acessíveis |
| **API** | NestJS 10 (TypeScript strict) | Framework enterprise com DI, guards e interceptors |
| **Worker** | NestJS headless + BullMQ | Reutiliza a mesma DI/config da API sem overhead HTTP |
| **Banco** | PostgreSQL 16 + Prisma ORM | Type-safe queries, migrations automáticas |
| **Fila** | Redis 7 + BullMQ | Retry nativo, backoff exponencial, job deduplication |
| **Proxy** | Nginx (Alpine) | Reverse proxy unificando frontend + API na porta 80 |
| **Mock** | Express.js | Simula resposta da prefeitura (70% sucesso / 30% erro) |
| **Segurança** | AES-256-GCM, JWT, bcrypt | Criptografia autenticada + tokens + hash de senhas |
| **Testes** | Jest, Vitest, MSW, React Testing Library | Backend + Frontend com 23 testes automatizados |
| **CI/CD** | GitHub Actions | Pipeline automática: Lint → Build → Test |

---

## Como Rodar Localmente

### Pré-requisitos
- [Docker](https://www.docker.com/) e Docker Compose instalados
- Git

### Passo a Passo

```bash
# 1. Clone o repositório
git clone https://github.com/MatteusDluca/EmissorDeNFS.git
cd EmissorDeNFS

# 2. Copie as variáveis de ambiente e preencha as senhas
cp .env.example .env

# 3. Suba todos os serviços (build + start)
docker compose up --build -d

# 4. (Primeiro uso) Execute o seed do admin
docker compose exec api npx prisma db seed
```

### Acessando a aplicação

| Serviço | URL |
|---------|-----|
| **Aplicação (Frontend + API)** | `http://localhost` |
| **API direta** | `http://localhost:3000` |

**Credenciais padrão:** `admin` / `admin` (definidas no seed)

---

## Variáveis de Ambiente

O arquivo `.env.example` lista todas as variáveis necessárias. Antes de rodar, copie para `.env` e preencha as marcações `<YOUR_...>`.

| Variável | Descrição | Exemplo / Padrão |
|----------|-----------|------------------|
| `POSTGRES_PASSWORD` | Senha do banco de dados | `minha_senha_forte` |
| `JWT_SECRET` | Chave secreta para assinatura dos tokens JWT | `secret_super_seguro` |
| `CERT_SECRET` | Chave AES (32 chars) para criptografar senha do .pfx | `01234567890123456789012345678901` |
| `ADMIN_PASSWORD` | Senha do usuário seed `admin` | `admin` |
| `WEBHOOK_URL` | Endpoint que receberá o POST em caso de sucesso | `http://host.docker.internal:5678/webhook` |
| `WORKER_CONCURRENCY` | Quantidade de notas processadas em paralelo | `3` |

> **Prática de Segurança:** Segredos reais nunca são commitados no repositório. O arquivo `.env.example` serve apenas como catálogo de estrutura.

---

## Endpoints da API

Todos os endpoints (exceto `/auth/login` e `/health`) requerem autenticação via **Bearer Token JWT**.

### Autenticação
| Método | Rota | Descrição | Resposta |
|--------|------|-----------|----------|
| `POST` | `/auth/login` | Login com username/password | `{ accessToken: "jwt..." }` |

### Certificados Digitais (Auth)
| Método | Rota | Descrição | Resposta |
|--------|------|-----------|----------|
| `GET` | `/certificates` | Lista certificados do usuário | `[{ id, fileName, isLatest }]` |
| `POST` | `/certificates/upload` | Upload de .pfx (multipart/form-data) | `{ id, message }` |

### Vendas (Auth)
| Método | Rota | Descrição | Resposta |
|--------|------|-----------|----------|
| `POST` | `/sales` | Criar venda → enfileira emissão | `202 Accepted` |
| `GET` | `/sales` | Listar vendas do usuário | `[{ id, externalId, status, ... }]` |
| `GET` | `/sales/:id` | Detalhe de uma venda | `{ id, externalId, amount, ... }` |

### Notas Fiscais (Auth)
| Método | Rota | Descrição | Resposta |
|--------|------|-----------|----------|
| `GET` | `/notes` | Listar notas (filtro `?status=`) | `{ total, notes: [...] }` |
| `GET` | `/notes/kpi` | KPIs agregados (volume, sucesso, falha) | `{ totalAmount, totalSuccess, ... }` |
| `GET` | `/notes/:id` | Detalhe de uma nota | `{ id, status, protocol, ... }` |
| `POST` | `/notes/:id/retry` | Reenviar nota para a fila (retry manual) | `{ message, noteId }` |

### Infraestrutura
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Health check da API |

---

## Fluxo de Emissão de NFS-e

```
1. POST /sales         → Cria registro de Venda + NoteEmission
2. BullMQ enfileira    → Job com { saleId, userId, externalId }
3. Worker consome      → Carrega certificado .pfx + descriptografa senha (AES-256-GCM)
4. Worker monta XML    → Formato inspirado no padrão ABRASF
5. Worker → Prefeitura → HTTP POST com XML assinado
6. Prefeitura Mock     → 70% sucesso (retorna protocolo) / 30% erro aleatório
7. Worker atualiza BD  → Status SUCCESS ou ERROR + protocolo
8. SE sucesso          → Dispara webhook para URL configurada
9. SE erro             → BullMQ faz retry (3 tentativas, backoff exponencial)
```

**Regras de Negócio:**
- **Idempotência:** `externalId` único por venda + `jobId` do BullMQ evita processamento duplicado
- **Webhook apenas em sucesso:** Conforme requisito do edital, o webhook só é disparado quando a prefeitura aceita a NFS-e
- **Retry automático:** 3 tentativas com delays de 2s, 4s e 8s (backoff exponencial)
- **Retry manual:** O botão "Tentar Novamente" no Dashboard reenfileira a nota via `POST /notes/:id/retry`

---

## Frontend e Dashboard

O frontend é uma **SPA (Single Page Application)** construída com React 19 + Vite, utilizando componentes do Shadcn/ui com tema dark nativo.

### Telas

| Tela | Funcionalidade |
|------|---------------|
| **Login** | Autenticação com validação de campos e toast de erro |
| **Dashboard** | Painel com 4 KPIs em tempo real + tabela de notas com filtros + painel de certificados |
| **Nova Venda** | Formulário para cadastro de prestação de serviço |
| **Certificados** | Upload de .pfx com drag & drop e listagem do cofre |

### KPIs do Dashboard
- **Volume Transacionado** — soma dos valores das notas emitidas
- **Faturas Emitidas** — contagem de notas com status SUCCESS
- **Em Processamento** — contagem de notas na fila
- **Falhas de Emissão** — contagem de notas com status ERROR

### Funcionalidades Extras
- **Polling automático (3s):** Atualização da tabela enquanto houver notas processando
- **Filtro por status:** Botões para filtrar notas (Todas / Sucesso / Falhas)
- **Retry manual:** Botão por nota para reenfileirar via API
- **Skeleton loading:** Feedback visual durante carregamento

---

## Segurança

Atendendo às diretrizes da **OWASP** para manuseio de segredos e certificados:

| Camada | Implementação |
|--------|--------------|
| **Autenticação** | JWT (Bearer token) com expiração configurável |
| **Senhas de usuário** | Hashing com `bcrypt` (salt rounds automáticos) |
| **Senha do certificado** | Criptografia `AES-256-GCM` com IV aleatório + Auth Tag. Conforme o edital destaca, guardar em *plaintext* ou *base64* é vulnerabilidade. A chave de decriptação (`CERT_SECRET`) vive apenas na variável de ambiente do Worker. |
| **Certificados .pfx** | Armazenados de forma isolada no volume, nunca em banco de dados |
| **Segredos no repositório** | Senhas reais, tokens e chaves não são commitados. O `docker-compose.yml` e o `.env.example` usam *placeholders* (`<YOUR_PASSWORD>`) |
| **Validação de entrada** | `class-validator` em todos os DTOs |
| **Guards** | `JwtAuthGuard` protege todas as rotas de negócio |

---

## Testes Automatizados

O projeto possui **23 testes automatizados** distribuídos entre backend e frontend:

```bash
# Rodar todos os testes (local)
npm test

# Testes do Backend (API + Worker)
npm test --workspace=@nfse/api     # 13 testes (3 suites)
npm test --workspace=@nfse/worker  # 2 testes  (1 suite)

# Testes do Frontend
npm test --workspace=frontend      # 8 testes  (1 suite)
```

### Cobertura de Testes

| Módulo | Framework | Testes | O que Cobre |
|--------|-----------|--------|-------------|
| **Auth** | Jest | 4 | Login, token JWT, hash bcrypt |
| **Certificates** | Jest | 4 | Upload .pfx, criptografia AES, listagem |
| **Sales** | Jest | 5 | Criação, idempotência, enfileiramento BullMQ |
| **Worker** | Jest | 2 | Definição do processador, método process |
| **Frontend** | Vitest + MSW | 8 | Login, Dashboard, tabela, KPIs, certificados, vendas, logout |

> O **MSW (Mock Service Worker)** intercepta chamadas HTTP nos testes do frontend, simulando a API sem necessidade de backend real.

---

## Integração Webhook + N8n + Telegram (Bônus)

Como **diferencial extra**, o sistema pode ser integrado com o **N8n** (automação) para enviar notificações via **Telegram** quando uma NFS-e é emitida com sucesso.

### Como Funciona
1. Configure a variável `WEBHOOK_URL` no `.env` para apontar para seu workflow N8n
2. No N8n, crie um workflow com nó `Webhook` → `Telegram`
3. Quando o Worker processa uma nota com sucesso, ele dispara um POST na URL configurada
4. O N8n recebe o payload e envia a notificação formatada para o Telegram

> O arquivo `docs/n8n-webhook-workflow.json` contém o workflow pronto para importação.

---

## Estrutura do Projeto

```
nfs-e-emissor/
├── .github/workflows/
│   └── ci.yml                 # Pipeline CI (Lint → Build → Test)
├── apps/
│   ├── api/                   # API NestJS (REST)
│   │   ├── prisma/            # Schema, migrations e seed
│   │   └── src/
│   │       ├── common/        # Guards, filters, interceptors, health
│   │       ├── config/        # Validação de variáveis de ambiente
│   │       ├── infrastructure/# PrismaService (singleton)
│   │       └── modules/
│   │           ├── auth/      # JWT + Local strategy + bcrypt
│   │           ├── certificates/ # Upload .pfx + AES-256-GCM
│   │           ├── notes/     # Listagem + KPIs + retry manual
│   │           ├── sales/     # CRUD + enqueue BullMQ
│   │           └── webhook/   # Dispatcher HTTP configurável
│   ├── frontend/              # React SPA (Vite + Tailwind + Shadcn)
│   │   └── src/
│   │       ├── features/      # Dashboard, Sales, Certificates, Login
│   │       ├── components/ui/ # Shadcn/ui components
│   │       ├── stores/        # Zustand (auth state)
│   │       └── tests/         # Vitest + MSW + React Testing Library
│   ├── worker/                # Worker NestJS headless
│   │   └── src/
│   │       └── processors/    # NoteEmissionProcessor (BullMQ)
│   └── prefeitura-mock/       # Mock Express (70% OK / 30% erro)
├── packages/
│   └── shared/                # DTOs, interfaces, enums, crypto utils
├── infra/
│   └── nginx/                 # Configuração do reverse proxy
├── docs/
│   └── n8n-webhook-workflow.json  # Workflow N8n importável
├── docker-compose.yml         # Orquestração de 6 containers
└── .env.example               # Template de variáveis de ambiente
```

---

## Trade-offs e Decisões Técnicas

| Decisão | Justificativa |
|---------|---------------|
| **Mock da prefeitura** | Ambiente controlado sem dependência externa. Taxa de erro de 30% força o teste de resiliência |
| **XML simplificado** | Foco na demonstração do fluxo assíncrono, não na complexidade do ABRASF v2.04 |
| **Assinatura digital mock** | Em produção seria usado `xml-crypto` ou `node-forge` com certificado real |
| **Monorepo npm workspaces** | Compartilhamento de DTOs e utils entre API e Worker via `@nfse/shared` |
| **Worker NestJS headless** | Reutiliza DI (Prisma, Config) sem overhead de servidor HTTP |
| **AES-256-GCM** | Criptografia autenticada — protege confidencialidade e integridade |
| **Webhook apenas em sucesso** | Requisito do edital: notificar apenas quando a prefeitura aceitar a NFS-e |
| **Docker multi-stage** | Imagens otimizadas: build com devDependencies → produção apenas com runtime |
| **Graceful shutdown** | Worker e API encerram limpo, finalizando jobs em andamento antes de parar |
| **Retry manual via UI** | Permite ao operador reprocessar notas com erro sem acesso ao terminal |

---

## Uso de IA e Ferramentas

Ferramentas de IA generativa foram usadas como **pair programmer** durante o desenvolvimento, conforme permitido pelo desafio. Saber conduzir a IA faz parte do skillset de um dev moderno — o ganho está na velocidade sem perder o controle técnico.

**O que a IA ajudou a acelerar:**
- Scaffolding de componentes React com Shadcn/ui e Tailwind
- Boilerplate de tipagens TypeScript, DTOs e configurações repetitivas
- Redação inicial de suítes de teste e mocks do MSW

**O que foi pensado e decidido por mim:**
- Arquitetura completa (API + Worker headless + Fila + Mock como serviço separado)
- Estratégia de criptografia do certificado A1 (AES-256-GCM, não base64)
- Design de idempotência (externalId + jobId BullMQ)
- Retry com backoff exponencial e retry manual via Dashboard
- Pipeline de CI (GitHub Actions) e resolução de todos os problemas de integração

---

## Limitações Conhecidas

**Deploy em Nuvem:** Os free tiers atuais de plataformas PaaS (Render, Railway, Fly.io) não suportam a execução simultânea de API + Worker + PostgreSQL + Redis sem cartão de crédito ou hibernação forçada das instâncias. O projeto foi entregue via Plano B (Docker local + vídeo demo).

**Assinatura Digital Simplificada:** O XML enviado à Prefeitura Mock usa uma assinatura simulada. Em produção real, seria substituído por `xml-crypto` ou `node-forge` com certificado A1 válido.

**Desafios resolvidos durante o desenvolvimento:**
- 3 testes do Frontend falhavam porque as URLs do MSW não batiam com a baseURL real do Axios — a investigação revelou a discrepância entre `http://localhost/api/` e `http://localhost:3000/`, resolvida com uma única correção cirúrgica
- Teste de certificados esperava que o sistema deletasse certificados antigos, mas a regra de negócio evoluiu para manter histórico — o teste foi atualizado para refletir o comportamento correto

---

## Demonstração em Vídeo (Plano B)

> **[Link do vídeo de demonstração em breve]**

Devido às limitações dos free tiers de plataformas cloud, a entrega foi feita via **vídeo de demonstração com containerização local (Plano B)**, cumprindo o roteiro exigido no edital:

1. `docker compose up` subindo os 6 serviços do zero
2. Login na aplicação com usuário *seed*
3. Upload de certificado digital .pfx
4. Criação de uma *Sale* (Venda) pelo formulário
5. Status mudando na lista (PROCESSING → SUCCESS / ERROR)
6. (Bônus) Notificação de sucesso via Telegram com integração N8n

---

## Contato

**Matteus Dluca**

- GitHub: [@MatteusDluca](https://github.com/MatteusDluca)

---

**Status:** Completo | **Licença:** MIT | **Testes:** 23/23 passando
