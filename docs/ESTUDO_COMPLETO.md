# Documento de Estudo Completo — NFS-e Emissor Simplificado

> **Objetivo:** Preparar o Matteus para apresentar o projeto inteiro de cor na entrevista técnica.
> Este documento explica cada decisão, cada biblioteca, cada trecho de código e como tudo se conecta.

---

# PARTE 1: VISÃO GERAL DA ARQUITETURA

## O que o sistema faz (em 30 segundos)

O sistema recebe uma **venda** via API REST (POST /sales), coloca essa venda numa **fila assíncrona** (Redis + BullMQ), um **Worker** separado consome essa fila e monta um **XML** imitando o padrão da prefeitura (ABRASF), envia esse XML via HTTP para um **serviço Mock** que simula a prefeitura (70% sucesso, 30% erro), e atualiza o status da nota no banco de dados. Se der sucesso, dispara um **webhook** pra quem quiser ouvir (ex: N8n → Telegram). O frontend mostra tudo isso em tempo real.

## O que faz o sistema ser diferente de um CRUD simples

A mágica do projeto é que **nada é síncrono no caminho crítico**. Quando o usuário cria uma venda, a API responde **imediatamente** com `202 Accepted`. O processamento pesado (montar XML, chamar prefeitura, esperar 2-3 segundos) acontece **em background** num processo completamente separado. Se o avaliador perguntar "por que não processar tudo na request?", a resposta é:

- A prefeitura demora 2-3 segundos para responder
- Se tiver 100 vendas simultâneas, o servidor HTTP ficaria travado com 100 conexões pendentes
- Separar em fila permite **escalar horizontalmente** (rodar 5 Workers se quiser)
- Se a prefeitura cair, o BullMQ faz **retry automático** com backoff exponencial

---

# PARTE 2: INFRAESTRUTURA E DOCKER

## docker-compose.yml — Os 6 Containers

O projeto sobe exatamente **6 containers** com um único comando. Cada um tem uma responsabilidade bem definida:

| Container | Imagem/Build | Porta | Função |
|-----------|-------------|-------|--------|
| **postgres** | `postgres:16-alpine` | 5432 | Banco de dados relacional. Armazena users, sales, certificates e note_emissions |
| **redis** | `redis:7-alpine` | 6380 (externo) → 6379 (interno) | Cache/Fila. O BullMQ usa ele como broker de mensagens |
| **prefeitura-mock** | Build local (Express.js) | 4000 | Simula a prefeitura. Recebe XML e retorna sucesso ou erro aleatoriamente |
| **api** | Build local (NestJS) | 3000 | A API REST principal. Gerencia auth, vendas, notas, certificados |
| **worker** | Build local (NestJS headless) | Nenhuma | Consome a fila e processa notas. Não tem servidor HTTP (por decisão de design)|
| **nginx** | Build local (multi-stage com frontend) | 80 | Reverse proxy. Serve o React SPA e proxeia `/api/*` para a API |

### Por que o Worker não tem porta?
Porque ele é **headless** — não recebe requests HTTP. Ele só fica "ouvindo" a fila (Redis) e processando jobs. Isso economiza recursos e elimina superfície de ataque. Para saúde, usa um healthcheck simples: `node -e "process.exit(0)"` (se o Node está vivo, o container está bem).

### Ordem de subida (depends_on)
O Docker Compose usa `depends_on` com `condition: service_healthy` para garantir que tudo sobe na ordem certa:
1. Primeiro: **postgres** e **redis** (infraestrutura)
2. Depois: **prefeitura-mock** (não depende de nada)
3. Depois: **api** (depende de postgres + redis estarem healthy)
4. Depois: **worker** (depende de postgres + redis + prefeitura-mock)
5. Por último: **nginx** (depende da api estar healthy)

### Volume compartilhado de certificados
Tanto a API quanto o Worker montam `./certs:/app/certs`. Isso significa que quando a API salva um certificado `.pfx` no disco, o Worker consegue lê-lo. É um volume de host, não de Docker — os arquivos ficam na pasta `./certs` da máquina.

## nginx.conf — O Reverse Proxy

O Nginx faz duas coisas:
1. **Serve o frontend** (arquivos estáticos do React build) na raiz `/`
2. **Proxeia a API** — qualquer request para `/api/*` é redirecionado para `http://api:3000/`

O `try_files $uri $uri/ /index.html` é fundamental: se alguém acessar `/dashboard` diretamente no browser, o Nginx não encontra um arquivo chamado "dashboard", então serve o `index.html` — e o React Router assume dali.

**Headers de segurança** adicionados:
- `X-Frame-Options: SAMEORIGIN` — impede clickjacking
- `X-Content-Type-Options: nosniff` — impede MIME sniffing
- `X-XSS-Protection: 1; mode=block` — ativa proteção XSS do browser
- `Referrer-Policy: strict-origin-when-cross-origin` — controla o que vai no header Referer

**Gzip** está ativado para comprimir JS, CSS e JSON — melhora o tempo de carregamento do frontend.

---

# PARTE 3: O BANCO DE DADOS (Prisma + PostgreSQL)

## As 4 tabelas

### User
```
users
├── id (UUID, PK)
├── username (String, UNIQUE)
├── password (String) ← hash bcrypt, NUNCA texto puro
├── created_at
└── updated_at
```
- Relação 1:N com Certificate (um user pode ter vários certificados)
- Relação 1:N com Sale (um user pode ter várias vendas)
- onDelete: Cascade em ambas (se deletar o user, deleta tudo dele)

### Certificate
```
certificates
├── id (UUID, PK)
├── user_id (FK → users) ← quem fez upload
├── file_path (String) ← caminho no disco: "./certs/userId-timestamp.pfx"
├── encrypted_password (String) ← senha criptografada AES-256-GCM
├── iv (String) ← vetor de inicialização (16 bytes hex)
├── auth_tag (String) ← tag de autenticação GCM (integridade)
├── created_at
└── updated_at
```
A tabela armazena 3 componentes da criptografia: o texto cifrado, o IV e o AuthTag. Os três juntos + a chave (`CERT_SECRET`) permitem descriptografar. Se qualquer um for adulterado, a descriptografia falha (pois o GCM é **autenticado**).

### Sale
```
sales
├── id (UUID, PK)
├── user_id (FK → users)
├── external_id (String, UNIQUE) ← ID do sistema do cliente para idempotência
├── tomaker_name (String) ← razão social do tomador
├── tomaker_document (String) ← CNPJ/CPF
├── tomaker_email (String)
├── service_description (String)
├── amount (Decimal 15,2) ← valor do serviço
├── status (String) ← PENDING | PROCESSING | COMPLETED | FAILED
├── created_at
└── updated_at
```
O `external_id` é UNIQUE — é assim que garantimos **idempotência**. Se o cliente enviar a mesma venda duas vezes (mesmo externalId), a segunda vez retorna `409 Conflict` em vez de criar duplicata.

### NoteEmission
```
note_emissions
├── id (UUID, PK)
├── sale_id (FK → sales, UNIQUE) ← cada venda tem no máximo 1 nota
├── status (String) ← PENDING | PROCESSING | SUCCESS | ERROR
├── protocol (String?) ← número do protocolo retornado pela prefeitura
├── xml_sent (Text?) ← o XML que enviamos
├── xml_response (Text?) ← o XML que a prefeitura devolveu
├── error_message (Text?) ← mensagem de erro se falhou
├── attempts (Int) ← quantas tentativas foram feitas
├── processed_at (DateTime?) ← quando foi processado com sucesso
├── created_at
└── updated_at
```
A relação Sale ↔ NoteEmission é 1:1. `sale_id` é UNIQUE, então uma venda só pode ter uma emissão de nota.

## O Seed (seed.ts)
O seed cria um usuário admin com senha hasheada via bcrypt (10 salt rounds). Usa `upsert` — se já existe, não faz nada; se não existe, cria. Isso torna o seed **idempotente** (pode rodar várias vezes sem problema).

---

# PARTE 4: BACKEND — API (NestJS)

## main.ts — O Ponto de Entrada

O `main.ts` configura 5 coisas globais antes de escutar na porta:

1. **ValidationPipe** — Usa `class-validator` em todos os DTOs. `whitelist: true` remove campos extras (que poderiam ser injeção). `forbidNonWhitelisted: true` retorna erro se mandou campo que não existe.

2. **AllExceptionsFilter** — Captura QUALQUER exceção não tratada (incluindo erros do Prisma, erros de runtime, etc.) e retorna um JSON padronizado com `statusCode`, `timestamp`, `path`, `method`, `correlationId` e a mensagem. Sem isso, o NestJS retornaria stack traces em produção.

3. **CorrelationIdInterceptor** — Gera um UUID v4 para cada request HTTP. Se o header `X-Correlation-ID` já veio (do Nginx), usa ele. Se não, gera um novo. Isso permite rastrear uma request do frontend até o Worker nos logs.

4. **CORS** — Habilitado com `origin: *` (aceita qualquer origem). Em produção seria restrito, mas como é um teste técnico com Docker local, faz sentido ser aberto.

5. **enableShutdownHooks()** — Quando o container recebe SIGTERM (Docker parou), o NestJS fecha as conexões de forma limpa (Prisma, Redis) antes de morrer. Isso evita corrupção de dados e jobs órfãos no BullMQ.

## app.module.ts — O Módulo Raiz

O `AppModule` importa tudo:

- **ConfigModule.forRoot()** — Carrega configurações de 7 namespaces (app, database, redis, jwt, cert, prefeitura, webhook) e valida com **Joi**. Se faltar `JWT_SECRET` ou `CERT_SECRET`, a aplicação nem sobe. `envFilePath: ['.env', '../../.env']` busca o .env localmente ou na raiz do monorepo.

- **BullModule.forRoot()** — Conecta ao Redis para o BullMQ. Usa `process.env.REDIS_HOST` diretamente (porque o ConfigModule ainda não resolveu quando o BullModule é inicializado).

- **PrismaModule** — Singleton do Prisma Client, disponível para injeção em qualquer service.

- **5 Feature Modules**: AuthModule, CertificatesModule, SalesModule, NotesModule, WebhookModule.

## Config e Validação

### app.config.ts
Usa `registerAs()` do NestJS para criar **namespaces tipados**. Ex: `configService.get<string>('jwt.secret')` em vez de `configService.get('JWT_SECRET')`. Isso dá autocomplete e documenta as envs.

### validation.schema.ts
Usa **Joi** para validar TODAS as variáveis de ambiente no boot. Se `DATABASE_URL` não for URI válida, ou se `JWT_SECRET` tiver menos de 16 caracteres, a aplicação falha com erro claro. Isso evita erros "silenciosos" em runtime.

**Por que Joi e não class-validator?** O NestJS Config Module tem integração nativa com Joi para validar envs. É diferente do class-validator que é usado nos DTOs de request body.

---

# PARTE 5: MÓDULO DE AUTENTICAÇÃO

## Como funciona o fluxo de login

1. Frontend envia `POST /auth/login` com `{ username, password }`
2. O controller usa `@UseGuards(AuthGuard('local'))` — o Passport.js chama a `LocalStrategy`
3. A `LocalStrategy.validate()` chama `authService.validateUser()`
4. O `AuthService.validateUser()`:
   - Busca o user no banco por username
   - Compara a senha com `bcrypt.compare(senhaDigitada, hashDoBanco)`
   - Se bater, retorna `{ id, username }`
   - Se não bater, lança `UnauthorizedException`
5. O controller então chama `authService.login(user)` que gera o JWT
6. O JWT contém: `{ sub: userId, username: "admin" }` assinado com JWT_SECRET

## Bibliotecas envolvidas

| Biblioteca | Pra que serve |
|-----------|---------------|
| **@nestjs/passport** | Integra o Passport.js com NestJS (DI, decorators) |
| **passport** | Framework genérico de autenticação |
| **passport-local** | Strategy que valida username/password |
| **passport-jwt** | Strategy que valida tokens JWT no header |
| **@nestjs/jwt** | Wrapper do `jsonwebtoken` com DI do NestJS |
| **bcrypt** | Hash de senhas (one-way, com salt automático) |

## JwtStrategy — Protegendo rotas

A `JwtStrategy` é usada pelo `JwtAuthGuard` em todas as rotas protegidas. Como funciona:

1. Extrai o token do header `Authorization: Bearer <token>` via `ExtractJwt.fromAuthHeaderAsBearerToken()`
2. Verifica a assinatura com `jwt.secret`
3. Decodifica o payload e pega o `sub` (userId)
4. Busca o user no banco para confirmar que ainda existe
5. Se tudo OK, injeta `{ id, username }` no `req.user`

**Detalhe importante**: O `validate()` da JwtStrategy faz uma query ao banco em TODA request autenticada. Isso garante que se o user for deletado do banco, o token antigo dele para de funcionar imediatamente.

---

# PARTE 6: MÓDULO DE CERTIFICADOS

## O fluxo de upload do .pfx

1. Frontend envia `POST /certificates/upload` com `multipart/form-data` (arquivo .pfx + senha)
2. O controller usa `@UseInterceptors(FileInterceptor('file'))` do Multer para parsear o upload
3. Validação no interceptor: máx 10MB, só aceita .pfx e .p12
4. O service `uploadCertificate()`:
   - Valida a extensão novamente (defesa em profundidade)
   - Cria o diretório `./certs` se não existir
   - Salva o arquivo no disco com nome `userId-timestamp.pfx` (para suportar múltiplos certificados)
   - **Criptografa a senha** com `encrypt(password, CERT_SECRET)` → retorna `{ encrypted, iv, authTag }`
   - Salva no banco: `filePath`, `encryptedPassword`, `iv`, `authTag`

## A criptografia AES-256-GCM em detalhe

**O que é e por que foi escolhido:**
- AES-256 = algoritmo de criptografia simétrica com chave de 256 bits (praticamente inquebrável)
- GCM = Galois/Counter Mode — modo que além de **criptografar** (confidencialidade), também **autentica** (integridade). Se alguém alterar o texto cifrado, a descriptografia falha com erro
- É o algoritmo recomendado pela OWASP para dados sensíveis em repouso

**Como funciona no código (shared.ts):**

```
encrypt(plaintext, secret):
1. deriveKey(secret) → SHA256 do secret → pega os primeiros 32 bytes (256 bits)  
2. randomBytes(16) → gera um IV aleatório de 16 bytes  
3. createCipheriv('aes-256-gcm', key, iv) → cria o cifrador  
4. cipher.update(plaintext) + cipher.final() → gera o texto cifrado (hex)  
5. cipher.getAuthTag() → gera o auth tag (16 bytes, hex)  
6. Retorna: { encrypted, iv, authTag } ← os 3 são salvos no banco
```

```
decrypt(encryptedText, iv, authTag, secret):
1. deriveKey(secret) → mesma derivação de chave  
2. createDecipheriv('aes-256-gcm', key, iv) → cria o decifrador  
3. decipher.setAuthTag(authTag) → configura a tag de autenticação  
4. decipher.update(encryptedText) + decipher.final() → texto original  
   Se a authTag não bater → ERRO (dados foram adulterados)
```

**Por que não usar base64?** O edital fala explicitamente: "base64 não resolve" — e ele está certo. Base64 é uma **codificação**, não criptografia. Qualquer um decodifica. AES-256-GCM é criptografia **real** que pede uma chave secreta.

**Onde vive a CERT_SECRET?** Apenas na variável de ambiente do Worker e da API. Nunca no banco, nunca no código-fonte, nunca no Git.

---

# PARTE 7: MÓDULO DE VENDAS (SALES)

## O que acontece quando POST /sales é chamado

1. **Verifica certificado** — Se o user não fez upload de .pfx, retorna 400. Sem certificado, não dá pra "assinar" a nota.
2. **Verifica idempotência** — Busca por `externalId` no banco. Se já existe, retorna `409 Conflict` com o `saleId` e status atuais.
3. **Transação Prisma** — Cria a Sale e a NoteEmission atomicamente. Se um falhar, ambos são rollbackeados.
4. **Enfileira job no BullMQ** — O job contém `{ saleId, userId, externalId }`. O `jobId` é o próprio `externalId`, garantindo idempotência no nível da fila também (BullMQ rejeita jobs com ID duplicado).
5. **Retorna 202 Accepted** — A resposta é imediata. O processamento real acontece no Worker.

### Configuração do Job BullMQ

```javascript
{
    jobId: dto.externalId,           // Idempotência da fila
    attempts: 3,                      // Máximo de tentativas
    backoff: {
        type: 'exponential',          // 2s → 4s → 8s
        delay: 2000,                  // Delay base
    },
    removeOnComplete: { age: 86400 }, // Remove job completo após 24h
    removeOnFail: { age: 604800 },    // Remove job falhado após 7 dias
}
```

**O que é backoff exponencial?** Quando o job falha, o BullMQ espera `2000ms` para a 1ª retry, `4000ms` para a 2ª, `8000ms` para a 3ª. Isso dá tempo para problemas temporários se resolverem (ex: a prefeitura estava fora por 2 segundos).

---

# PARTE 8: MÓDULO DE NOTAS (NOTES)

## As 4 operações

### findAllByUser — `GET /notes?status=SUCCESS`
Busca as notas do usuário com filtro opcional por status. Retorna `{ total, notes: [...] }`. Usa `include: { sale }` para trazer os dados da venda junto.

### findById — `GET /notes/:id`
Retorna o detalhe completo de uma nota, incluindo `xmlSent`, `xmlResponse`, `errorMessage` — para o modal de detalhes no frontend.

### getKpiSummary — `GET /notes/kpi`
Agrega dados para os 4 cards do Dashboard:
- **totalAmount**: `prisma.sale.aggregate({ _sum: { amount: true } })` — soma todos os valores
- **statusGroup**: `prisma.noteEmission.groupBy({ by: ['status'] })` — conta por status
- Depois separa em `totalSuccess`, `totalFailed`, `totalProcessing`

**Detalhe técnico**: PENDING e PROCESSING são contados juntos em `totalProcessing` (do ponto de vista do usuário, ambos significam "ainda não terminou").

### retryNote — `POST /notes/:id/retry`
O retry manual. Esse é um **diferencial** importante:
1. Verifica se a nota existe e pertence ao user
2. Verifica se o status é ERROR (só pode reprocessar falhas)
3. Reseta o status para PENDING e zera `attempts`
4. Gera um novo `jobId` único: `${externalId}-${Date.now()}`
5. Enfileira o job novamente no BullMQ

**Por que novo jobId?** Porque o BullMQ rejeitaria o job original (já existe com aquele ID). Adicionando timestamp, criamos um ID único que o BullMQ aceita.

---

# PARTE 9: O WORKER — O CORAÇÃO DO SISTEMA

## NoteEmissionProcessor (317 linhas)

O processor é a peça mais complexa do projeto. Ele herda de `WorkerHost` do NestJS BullMQ e implementa o método `process()`. Vou explicar cada passo:

### Passo 1 — Verificação de idempotência
Verifica se a nota já foi processada com sucesso. Se `status === 'SUCCESS'`, retorna sem fazer nada. Isso protege contra reprocessamento acidental.

### Passo 2 — Carregar certificado e descriptografar senha
Busca o certificado mais recente do userId. Verifica se o arquivo .pfx existe no disco. Descriptografa a senha usando `decrypt()` com o `CERT_SECRET`.

### Passo 3 — Montar XML
Chama `buildXml(sale, certPassword)`. O XML segue o padrão ABRASF simplificado:
- `<EnviarLoteRpsEnvio>` com namespace ABRASF
- Dados do RPS (número, série, tipo, data)
- Dados do serviço (valor, discriminação)
- Dados do tomador (CNPJ, razão social, email)
- `<Signature>` com valor mockado

**A assinatura é mockada** — em produção, usaríamos `xml-crypto` ou `node-forge` para assinar o XML com o certificado A1 real. O edital permite isso e pede para explicar no Trade-offs.

### Passo 4 — Atualizar status para PROCESSING
Antes de chamar a prefeitura, atualiza a nota para PROCESSING e salva o XML que será enviado.

### Passo 5 — Chamar a Prefeitura Mock
`axios.post(prefeituraUrl, xml, { headers: { 'Content-Type': 'application/xml' }, timeout: 30000 })`
O `validateStatus: () => true` faz com que o Axios não lance erro para status HTTP 4xx/5xx — o Worker trata os erros manualmente.

### Passo 6 — Processar resposta
- **Sucesso** (status 200 + XML contém `<Status>1</Status>` e `<Protocolo>`):
  - Extrai o protocolo via regex
  - Atualiza NoteEmission para SUCCESS
  - Atualiza Sale para COMPLETED
  - Dispara webhook
- **Erro** (qualquer outra coisa):
  - Extrai mensagem de erro via regex
  - Atualiza NoteEmission para ERROR
  - **Lança `throw new Error()`** — isso é crucial: o BullMQ captura o erro e faz retry

### Passo 7 — Webhook (fire-and-forget)
Se a WEBHOOK_URL está configurada, faz `axios.post()` com o payload JSON. Se falhar, apenas loga warning — **nunca afeta o fluxo principal**. Isso porque o webhook é uma notificação, não uma operação crítica.

---

# PARTE 10: A PREFEITURA MOCK

## app.js (Express.js) — Simples e funcional

Um serviço Express separado que simula o servidor SOAP da prefeitura:

1. Recebe `POST /nfse` com `Content-Type: application/xml`
2. Espera 2-3 segundos (simula processamento)
3. **70% chance de sucesso**: retorna XML com `<Status>1</Status>`, protocolo fake e código de verificação
4. **30% chance de erro**: retorna XML com código de erro aleatório (E001, E010, E050, E100)

### Os 4 tipos de erro simulados
| Código | Mensagem | Correção |
|--------|----------|----------|
| E001 | CNPJ do prestador inválido | Verifique o CNPJ |
| E010 | Erro ao processar lote de RPS | Tente novamente |
| E050 | Serviço temporariamente indisponível | Aguarde e reenvie |
| E100 | Certificado digital inválido ou expirado | Verifique a validade |

**Por que 70/30?** Se fosse 100% sucesso, o avaliador nunca veria o retry funcionando. 30% de erro demonstra perfeitamente: falha → BullMQ faz retry → sucesso na segunda tentativa.

**Graceful shutdown**: Escuta SIGTERM e SIGINT para encerrar limpo no Docker.

---

# PARTE 11: O FRONTEND (React + Vite)

## Stack e bibliotecas do Frontend

| Biblioteca | Pra que serve |
|-----------|---------------|
| **React 19** | Framework de UI |
| **Vite** | Build tool ultra-rápido (substitui Webpack) |
| **React Router DOM v6** | Navegação SPA (rotas client-side) |
| **TanStack React Query** | Cache de server state, polling automático, mutations |
| **Zustand** | Estado global minimalista (auth store) |
| **Shadcn/ui** | Componentes UI acessíveis e customizáveis (não é lib, são arquivos copiados) |
| **Tailwind CSS v4** | CSS utility-first |
| **Zod** | Validação de schemas TypeScript-first |
| **React Hook Form** | Gerenciamento de formulários performático |
| **Sonner** | Toast notifications elegantes |
| **Lucide React** | Ícones SVG |
| **Axios** | HTTP client com interceptors |

## App.tsx — Roteamento

```
/login          → Login.tsx (pública)
/dashboard      → Dashboard.tsx (protegida por AppLayout)
/sales          → SalesCreate.tsx (protegida)
/certificates   → CertificateUpload.tsx (protegida)
/*              → Redirect para /dashboard
```

O `AppLayout` é o wrapper que verifica se o user está autenticado (token presente no Zustand). Se não, redireciona para `/login`.

## authStore.ts — Zustand para autenticação

```javascript
{
    token: null,
    isAuthenticated: false,
    login: (token) => { localStorage.setItem('jwt_token', token); setState({ token, isAuthenticated: true }) },
    logout: () => { localStorage.removeItem('jwt_token'); setState({ token: null, isAuthenticated: false }) }
}
```
O token fica no `localStorage` para persistir entre refreshes. O interceptor do Axios injeta o token em todas as requests automaticamente.

**Evento custom `auth:unauthorized`**: Quando o Axios recebe 401, dispara `window.dispatchEvent(new Event('auth:unauthorized'))`. O Zustand escuta esse evento e faz logout automático. Isso garante que se o JWT expirar, o user é redirecto para login.

## api.ts — Axios interceptors

```
Request interceptor:
  → Pega o token do localStorage
  → Injeta no header: Authorization: Bearer <token>

Response interceptor:
  → Se receber 401: dispara evento 'auth:unauthorized'
  → Se receber outro erro: passa pra frente
```

## Dashboard.tsx (338 linhas) — O componente mais complexo

### React Query com polling inteligente
```javascript
refetchInterval: (query) => {
    const data = query.state?.data;
    const isProcessing = data.some(note => note.status === 'PROCESSING' || note.status === 'PENDING');
    return isProcessing ? 3000 : false; // Poll a cada 3s SÓ se tem notas pendentes
};
```
**Isso é eficiente**: não fica fazendo requests infinitas. Só faz polling enquanto existem notas processando. Quando todas são SUCCESS ou ERROR, para.

### Os 4 KPIs
Chamam `GET /notes/kpi` separadamente (com polling a cada 3s) e renderizam em 4 Cards. Cada card tem cor temática (verde=sucesso, âmbar=processando, vermelho=falha).

### Tabela de Notas
- Filtros por status (Todas, Sucesso, Falhas)
- Skeleton loading (5 linhas fantasma enquanto carrega)
- Cada linha mostra: externalId, Badge de status, Protocolo, Tentativas (x/3), Data
- Botão "Detalhes" abre Dialog/Modal

### Modal de Detalhes
Mostra o payload JSON completo da nota, a mensagem de erro (se houver) e o protocolo (se sucesso). Se a nota está com ERROR, mostra o botão **"Tentar Novamente"** que chama a mutation de retry.

### Cofre de Certificados (painel lateral)
Lista os certificados instalados com badge "Prioritário" no mais recente. Mostra nome do arquivo e data de upload.

## Login.tsx — Formulário com Zod

Usa `zodResolver(loginSchema)` integrado com React Hook Form. Quando submete:
1. Chama `POST /auth/login`
2. Se sucesso: salva token no Zustand → redirect para `/dashboard`
3. Se erro: toast com a mensagem do backend

## SalesCreate.tsx — Formulário de Venda

Schema Zod valida: externalId (obrigatório), tomakerName (mín 3 chars), tomakerDocument (mín 11), tomakerEmail (valid email), serviceDescription (mín 5), amount (> 0.01).

O `externalId` gera automático: `venda-${Math.random()}`. Isso facilita o demo — o user não precisa inventar IDs.

Quando submete, espera status `202` e redireciona para Dashboard com toast de sucesso.

## CertificateUpload.tsx — Upload com Drag & Drop

Implementa drag & drop nativo (onDragOver, onDragLeave, onDrop) + fallback de `<input type="file">`. Só aceita `.pfx`. Envia como `multipart/form-data` para `POST /certificates/upload`.

O label do campo de senha diz: "Será criptografada AES-256" — demonstra transparência pro usuário (e pro avaliador).

---

# PARTE 12: TESTES AUTOMATIZADOS

## 23 testes divididos em 5 suítes

### Backend (Jest)
- **Auth** (4 testes): Valida login com credenciais corretas, rejeita credenciais erradas, gera JWT com payload correto, hash bcrypt funciona
- **Certificates** (4 testes): Upload salva arquivo no disco, criptografa senha, lista certificados, armazena múltiplos sem deletar antigos
- **Sales** (5 testes): Cria venda com sucesso, retorna 409 para externalId duplicado, verifica certificado antes de criar, enfileira job no BullMQ, transação atômica (Sale + NoteEmission)
- **Worker** (2 testes): Processor é definido, método process existe

### Frontend (Vitest + MSW)
- **8 testes**: Login flow, Dashboard renderiza, tabela mostra dados mockados, KPIs carregam, filtro de status funciona, certificados listados, nova venda funciona, logout

### MSW (Mock Service Worker)
O MSW intercepta chamadas HTTP nos testes sem levantar servidor. Definido em `vitest.setup.ts`:
- `POST http://localhost:3000/auth/login` → retorna accessToken
- `GET http://localhost:3000/notes/kpi` → retorna KPIs mockados
- `GET http://localhost:3000/notes` → retorna array de notas
- `GET http://localhost:3000/certificates` → retorna array vazio

---

# PARTE 13: CI/CD (GitHub Actions)

## ci.yml — 4 steps simples

```yaml
steps:
  1. checkout
  2. setup Node.js 20.x com cache npm
  3. npm install
  4. npm run lint --if-present
  5. npm run build
  6. npm test
```

O pipeline roda em `ubuntu-latest` em push/PR para `main`/`master`. Se qualquer step falhar, o badge fica vermelho.

---

# PARTE 14: RESPOSTAS PARA PERGUNTAS DO ENTREVISTADOR

### "Por que NestJS e não Express puro?"
NestJS oferece DI (Dependency Injection) nativo, módulos organizados, decorators para routes/guards/interceptors, e integração com BullMQ via `@nestjs/bullmq`. Em Express puro, teria que configurar tudo na mão. Para um projeto com Worker separado que compartilha a mesma infra (Prisma, Config), a DI do NestJS é essencial.

### "Por que BullMQ e não RabbitMQ?"
BullMQ é baseado em Redis, que já estamos usando. Não precisa de broker separado. Tem retry com backoff nativo, deduplicação por jobId, e é a escolha natural no ecossistema Node.js. RabbitMQ seria overkill para este cenário.

### "Como funciona a idempotência?"
Dois níveis: (1) `externalId` UNIQUE no banco — a segunda request com mesmo ID retorna 409; (2) `jobId` do BullMQ usa o mesmo `externalId` — a fila rejeita jobs duplicados. Mesmo se o sistema restartar no meio, não haverá nota duplicada.

### "A assinatura digital é real?"
Não, é mockada. O XML tem `<SignatureValue>MOCK_SIGNATURE_timestamp</SignatureValue>`. Em produção, usaríamos `node-forge` para ler o certificado .pfx, extrair a chave privada, e assinar o XML com algoritmo RSA-SHA256. O edital permite e pede para explicar no Trade-offs.

### "O webhook é confiável?"
O webhook é fire-and-forget. Se a URL destino estiver fora do ar, o Worker loga warning mas não falha. Isso é proposital — o webhook é uma notificação, não parte do fluxo crítico. Em produção, poderíamos adicionar uma fila separada para webhooks com seus próprios retries.

### "Por que o Worker é headless?"
Economia de recursos. O Worker não precisa de servidor HTTP — ele só precisa do Redis (para ouvir a fila) e do PostgreSQL (para ler/escrever dados). Remover o servidor HTTP elimina uma superfície de ataque e reduz o consumo de memória.

---

**Última dica para a apresentação**: Sempre que o entrevistador perguntar algo, tente conectar com um **trade-off**. Ex: "usamos X porque Y, mas a limitação é Z, e em produção faríamos W". Isso mostra senioridade.
