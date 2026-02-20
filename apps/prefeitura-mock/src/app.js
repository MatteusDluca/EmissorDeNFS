const express = require('express');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.text({ type: ['text/xml', 'application/xml'] }));
app.use(express.json());

// ─── Health Check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'prefeitura-mock' });
});

// ─── POST /nfse - Mock de emissão de NFS-e ─────────────────────
app.post('/nfse', (req, res) => {
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    console.log(`[${new Date().toISOString()}] [${requestId}] Recebendo requisição de emissão de NFS-e`);
    console.log(`[${new Date().toISOString()}] [${requestId}] Content-Type: ${req.headers['content-type']}`);

    // Simula delay de processamento da prefeitura (2 segundos)
    const delay = 2000 + Math.random() * 1000; // 2-3 segundos

    setTimeout(() => {
        // 70% de chance de sucesso, 30% de erro
        const isSuccess = Math.random() < 0.70;

        if (isSuccess) {
            const protocol = generateProtocol();
            const nfseNumber = Math.floor(Math.random() * 999999) + 1;

            console.log(`[${new Date().toISOString()}] [${requestId}] ✅ NFS-e emitida com sucesso - Protocolo: ${protocol}`);

            const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsResposta xmlns="http://www.abrasf.org.br/nfse.xsd">
  <ListaMensagemRetorno>
    <MensagemRetorno>
      <Codigo>L000</Codigo>
      <Mensagem>Lote processado com sucesso</Mensagem>
    </MensagemRetorno>
  </ListaMensagemRetorno>
  <Protocolo>${protocol}</Protocolo>
  <DataRecebimento>${new Date().toISOString()}</DataRecebimento>
  <NumeroNfse>${nfseNumber}</NumeroNfse>
  <CodigoVerificacao>${generateVerificationCode()}</CodigoVerificacao>
  <Status>1</Status>
</EnviarLoteRpsResposta>`;

            res.set('Content-Type', 'application/xml');
            res.status(200).send(xmlResponse);
        } else {
            const errorCode = getRandomErrorCode();

            console.log(`[${new Date().toISOString()}] [${requestId}] ❌ Erro na emissão - Código: ${errorCode.code}`);

            const xmlError = `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsResposta xmlns="http://www.abrasf.org.br/nfse.xsd">
  <ListaMensagemRetorno>
    <MensagemRetorno>
      <Codigo>${errorCode.code}</Codigo>
      <Mensagem>${errorCode.message}</Mensagem>
      <Correcao>${errorCode.correction}</Correcao>
    </MensagemRetorno>
  </ListaMensagemRetorno>
  <Status>2</Status>
</EnviarLoteRpsResposta>`;

            res.set('Content-Type', 'application/xml');
            res.status(422).send(xmlError);
        }
    }, delay);
});

// ─── Helpers ───────────────────────────────────────────────────

function generateProtocol() {
    const year = new Date().getFullYear();
    const seq = Math.floor(Math.random() * 9999999).toString().padStart(7, '0');
    return `${year}${seq}`;
}

function generateVerificationCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function getRandomErrorCode() {
    const errors = [
        {
            code: 'E001',
            message: 'CNPJ do prestador inválido',
            correction: 'Verifique o CNPJ informado',
        },
        {
            code: 'E010',
            message: 'Erro ao processar lote de RPS',
            correction: 'Tente novamente em alguns minutos',
        },
        {
            code: 'E050',
            message: 'Serviço temporariamente indisponível',
            correction: 'Aguarde e reenvie o lote',
        },
        {
            code: 'E100',
            message: 'Certificado digital inválido ou expirado',
            correction: 'Verifique a validade do certificado',
        },
    ];
    return errors[Math.floor(Math.random() * errors.length)];
}

// ─── Start Server ──────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🏛️  Prefeitura Mock Service`);
    console.log(`   Rodando na porta ${PORT}`);
    console.log(`   Endpoint: POST /nfse`);
    console.log(`   Taxa de sucesso: ~70%`);
    console.log(`   Delay simulado: 2-3s\n`);
});

// ─── Graceful Shutdown ─────────────────────────────────────────
process.on('SIGTERM', () => {
    console.log('[Prefeitura Mock] Recebido SIGTERM, encerrando...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[Prefeitura Mock] Recebido SIGINT, encerrando...');
    process.exit(0);
});
