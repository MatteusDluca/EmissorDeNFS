# 📝 NFS-e Emissor Simplificado

> **Backend completo para emissão de Nota Fiscal de Serviço eletrônica (NFS-e)**

## 📋 Visão Geral

Sistema de emissão de NFS-e com processamento assíncrono via filas, integração com mock da prefeitura, criptografia de certificados digitais e webhook para notificações.

**Desenvolvido por:** Matteus Dluca

---

## 🏗️ Arquitetura

```
┌─────────┐     ┌───────┐     ┌──────────┐     ┌───────────────────┐
│ React UI│────▶│ Nginx │────▶│ API NestJS│────▶│ PostgreSQL + Redis│
└─────────┘     └───────┘     └──────────┘     └───────────────────┘
                                    │                     │
                                    ▼                     │
                              ┌──────────┐                │
                              │  BullMQ  │◀───────────────┘
                              └──────────┘
                                    │
                                    ▼
                              ┌──────────┐     ┌───────────────────┐
                              │  Worker  │────▶│ Prefeitura Mock   │
                              └──────────┘     └───────────────────┘
                                    │
                                    ▼
                              ┌──────────┐
                              │ Webhook  │
                              └──────────┘
```

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | Vite + React 19 + Tailwind CSS v4 + Shadcn/ui |
| **API** | NestJS 10 (TypeScript strict) |
| **Worker** | NestJS headless + BullMQ |
| **Banco** | PostgreSQL 16 + Prisma ORM |
| **Fila** | Redis 7 + BullMQ |
| **Proxy** | Nginx |
| **Mock** | Express.js |
| **Segurança** | AES-256-GCM, JWT, bcrypt |
| **Testes** | Jest, Supertest, Vitest, MSW, React Testing Library |

## 🎥 Entrega e Avaliação (Plano B)

Devido às limitações impostas pelos *Free Tiers* atuais das plataformas de nuvem, que frequentemente congelam ("spin down") instâncias de Backends e não oferecem Workers assíncronos que rodem 24/7 de forma gratuita sem registro de cartão de crédito, optei pelo **Plano B** como método final de entrega na avaliação.

Junto com este repositório, você encontrará (ou receberá via link) um vídeo rápido de demonstração da aplicação subindo totalmente `containerizada` usando o Docker e navegando pelo Dashboard para comprovar que todo o fluxo assíncrono entre Venda, Fila, Worker e Prefeitura Mock opera 100% conforme os requisitos de negócio e resiliência (com direito a falhas, sucessos e idempotência).

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- Docker e Docker Compose instalados

### Execução

```bash
# 1. Clone o repositório
git clone <repo-url> && cd nfs-e-emissor

# 2. Copie as variáveis de ambiente
cp .env.example .env

# 3. Suba todos os serviços
docker compose up --build -d

# 4. (Primeiro uso) Execute o seed do admin
docker compose exec api npx prisma db seed
```

A API estará disponível em `http://localhost:80` (via Nginx)

## 📡 Endpoints da API

### Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/login` | Login (retorna JWT) |

### Certificados (🔒 Auth)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/certificates/upload` | Upload certificado .pfx |

### Vendas (🔒 Auth)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/sales` | Criar venda → 202 Accepted |
| GET | `/sales` | Listar vendas |
| GET | `/sales/:id` | Detalhe da venda |

### Notas (🔒 Auth)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/notes` | Listar notas (filtro ?status=) |
| GET | `/notes/:id` | Detalhe da nota |

### Infraestrutura
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check |

## 🔐 Segurança

- **JWT** para autenticação (Bearer token)
- **bcrypt** para hash de senhas
- **AES-256-GCM** para criptografia da senha do certificado digital
- Certificados .pfx armazenados no disco, senha nunca armazenada em plaintext
- Validação de entrada via `class-validator`

## 🔄 Fluxo de Emissão

1. **POST /sales** → Cria venda + NoteEmission + enfileira job BullMQ
2. **Worker** consome job → carrega cert → descriptografa senha → monta XML ABRASF
3. **Worker** chama prefeitura mock via HTTP
4. **Prefeitura** responde (70% sucesso / 30% erro)
5. **Worker** atualiza status no banco + dispara webhook
6. Em caso de erro: **BullMQ** faz retry (3 tentativas, backoff exponencial)

## 🏆 Diferenciais

- **Idempotência**: `externalId` único + `jobId` do BullMQ
- **Criptografia**: AES-256-GCM com IV aleatório + auth tag
- **Retry automático**: BullMQ com 3 tentativas e backoff exponencial
- **Webhook**: Notificação automática de sucesso/erro
- **Monorepo**: npm workspaces (`apps/*`, `packages/*`)
- **Testes**: Unitários (Jest) + E2E (Supertest)
- **Correlation ID**: Rastreamento de requests end-to-end
- **Docker multi-stage**: Imagens otimizadas para produção
- **Graceful shutdown**: Worker e API encerram limpo

## 📁 Estrutura do Projeto

```
nfs-e-emissor/
├── apps/
│   ├── api/                  # API NestJS
│   │   ├── prisma/           # Schema + migrations + seed
│   │   ├── src/
│   │   │   ├── common/       # Guards, filters, interceptors
│   │   │   ├── config/       # Validação e carregamento de config
│   │   │   ├── infrastructure/# PrismaService
│   │   │   └── modules/
│   │   │       ├── auth/     # JWT + Local strategy
│   │   │       ├── certificates/  # Upload .pfx + criptografia
│   │   │       ├── notes/    # Listagem de notas
│   │   │       ├── sales/    # Vendas + enqueue
│   │   │       └── webhook/  # Dispatcher de webhooks
│   │   └── test/             # Testes E2E
│   ├── worker/               # Worker NestJS headless
│   │   └── src/
│   │       └── processors/   # Processamento de notas
│   └── prefeitura-mock/      # Mock da prefeitura (Express)
├── packages/
│   └── shared/               # DTOs, interfaces, enums, crypto utils
├── infra/
│   ├── nginx/                # Configuração Nginx
│   └── postgres/             # SQL de inicialização
├── docker-compose.yml
└── .env.example
```

## 🧪 Testes

```bash
# Testes unitários
docker compose exec api npm test

# Testes E2E (requer banco e Redis)
docker compose exec api npm run test:e2e

# Coverage
docker compose exec api npm run test:cov
```

## 📦 Trade-offs e Decisões

| Decisão | Justificativa |
|---------|--------------|
| Mock da prefeitura | Ambiente controlado para teste sem dependência externa |
| XML simplificado | Foco no fluxo, não na complexidade do ABRASF completo |
| Assinatura mock | Em produção usaria `xml-crypto` ou `node-forge` |
| Monorepo npm workspaces | Compartilhamento de código simplificado |
| Worker NestJS headless | Reutiliza DI/config sem HTTP server |
| AES-256-GCM | Criptografia autenticada (protege contra tampering) |

---

**Status:** ✅ Completo | **Licença:** MIT
