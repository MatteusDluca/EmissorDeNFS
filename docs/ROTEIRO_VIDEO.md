# Roteiro de Gravacao do Video — NFS-e Emissor

> Grave com Loom (tela + webcam). Fale naturalmente, sem ler.
> Tempo estimado: 5-8 minutos.

---

## ANTES DE GRAVAR

### Preparacao (fazer ANTES de apertar "Record")

1. Fechar Docker Desktop e abrir de novo (garantir que ta limpo)
2. Abrir terminal no diretorio `nfs-e-emissor`
3. Rodar `docker compose down -v --rmi all --remove-orphans` para garantir zero residuo
4. Ter um arquivo `.pfx` pronto na area de trabalho (qualquer .pfx de teste serve)
5. Ter o browser aberto em uma aba vazia
6. Se for mostrar N8n + Telegram: subir o N8n antes (`docker run -d --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n n8nio/n8n`) e deixar o workflow pronto

---

## CENA 1 — Subindo tudo do zero (Terminal)

**O que mostrar:** Terminal vazio → `docker compose up --build`

**O que falar:**
> "Vou subir o projeto inteiro do zero com um unico comando. Sao 6 containers: PostgreSQL, Redis, a API em NestJS, o Worker que processa a fila, o mock da prefeitura e o Nginx como reverse proxy servindo o frontend React."

**Acao:**
```bash
docker compose up --build
```

**Esperar ate:** Os logs mostrarem todos os containers healthy e a API logando `Application started on port 3000`.

**Ponto de destaque:** Mencionar que o seed do usuario admin roda automaticamente e que as migrations do Prisma acontecem na subida.

---

## CENA 2 — Login (Browser)

**O que mostrar:** Acessar `http://localhost` → tela de login

**O que falar:**
> "O frontend carrega via Nginx na porta 80. A pagina de login usa React Hook Form com validacao Zod. Vou logar com o usuario seed."

**Acao:**
1. Acessar `http://localhost`
2. Digitar `admin` no campo usuario
3. Digitar `admin123` no campo senha (ou a senha que estiver no .env)
4. Clicar "Acessar Plataforma"

**Ponto de destaque:** Mostrar o toast de sucesso aparecendo. Mencionar que a autenticacao usa JWT com Passport.js.

---

## CENA 3 — Upload de Certificado (Pagina Certificados)

**O que mostrar:** Navegar ate certificados → fazer upload

**O que falar:**
> "Antes de emitir notas, preciso instalar um certificado digital. A senha do certificado e criptografada com AES-256-GCM antes de ir pro banco. Nao armazenamos em texto puro nem em base64."

**Acao:**
1. Clicar em "Certificados" no menu lateral
2. Arrastar o arquivo `.pfx` para o drag & drop (ou clicar e selecionar)
3. Digitar qualquer senha no campo (ex: `minha-senha-123`)
4. Clicar "Guardar no Cofre Seguro"

**Ponto de destaque:** Mostrar o toast de sucesso. Mencionar que o arquivo vai pro disco e a senha e criptografada em tripla camada GCM.

---

## CENA 4 — Criando uma Venda (Pagina Nova Venda)

**O que mostrar:** Navegar ate Nova Venda → preencher → submeter

**O que falar:**
> "Agora vou criar uma venda. Quando eu clicar em submeter, a API responde imediatamente com 202 Accepted. O processamento real acontece em background no Worker via BullMQ."

**Acao:**
1. Clicar em "Nova Venda" no menu
2. O `externalId` ja vem preenchido automaticamente
3. Preencher os campos:
   - Nome: `Empresa Cliente LTDA`
   - CNPJ: `12345678000199`
   - Email: `contato@empresa.com`
   - Descricao: `Consultoria em TI`
   - Valor: `1500`
4. Clicar "Finalizar Venda e Emitir NFS-e"

**Ponto de destaque:** Mostrar o toast dizendo que foi pra fila. Mencionar o 202 Accepted (nao e 200/201).

---

## CENA 5 — Monitorando o Status no Dashboard

**O que mostrar:** Dashboard com a nota mudando de status em tempo real

**O que falar:**
> "No dashboard os KPIs atualizam em tempo real via polling inteligente do React Query. A nota comeca como PENDING, passa pra PROCESSING quando o Worker pega, e termina como SUCCESS ou ERROR. Se der erro, o BullMQ faz retry automatico com backoff exponencial."

**Acao:**
1. Observar o status mudar: PENDING → PROCESSING → SUCCESS (ou ERROR)
2. Se der SUCCESS: mostrar o protocolo que aparece na tabela
3. Se der ERROR: clicar em "Detalhes" → mostrar a mensagem de erro da prefeitura → clicar "Tentar Novamente"

**Ponto de destaque:** Criar 2-3 vendas rapidas pra mostrar que varias processam em paralelo. Mostrar os KPIs subindo em tempo real.

---

## CENA 6 — Mostrando o Modal de Detalhes

**O que mostrar:** Clicar no botao "Detalhes" de uma nota emitida

**O que falar:**
> "Aqui no modal consigo ver o trace completo da emissao: o ID, o protocolo da prefeitura, quantas tentativas foram feitas, e o payload JSON completo."

**Acao:**
1. Clicar em "Detalhes" de uma nota SUCCESS
2. Mostrar o protocolo verde
3. Mostrar o payload JSON completo

---

## CENA 7 (BONUS) — Webhook + N8n + Telegram

> Essa cena so se o N8n tiver configurado. Se nao tiver, pule.

**O que falar:**
> "Como bonus, integrei o sistema com N8n para receber notificacoes no Telegram. Quando uma nota e emitida com sucesso, o Worker dispara um webhook que o N8n recebe e encaminha pro Telegram."

**Acao:**
1. Mostrar o N8n (`http://localhost:5678`) com o workflow ativo
2. Criar uma nova venda
3. Esperar o SUCCESS
4. Mostrar a mensagem chegando no Telegram

---

## CENA 8 — Encerramento (Voltar pro terminal)

**O que falar:**
> "Esse foi o fluxo completo: subimos 6 containers do zero, logamos, instalamos um certificado com criptografia AES-256, criamos vendas com processamento assincrono via BullMQ, e monitoramos tudo em tempo real. O projeto tambem tem CI/CD com GitHub Actions, testes automatizados com Jest e Vitest, e toda a seguranca seguindo OWASP. Obrigado!"

---

## DICAS PARA A GRAVACAO

- **Fale devagar** nos termos tecnicos (AES-256-GCM, BullMQ, idempotencia)
- **Nao leia** — fale naturalmente, como se estivesse explicando pra um colega
- **Mostre os logs** do terminal brevemente (o Worker logando que processou)
- **Se der ERROR** na nota, MELHOR AINDA — mostra o retry funcionando
- **Crie pelo menos 3 vendas** pra mostrar o dashboard com dados
- **Mantenha por volta de 5-7 minutos** — objetivo e completo
