import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Job } from 'bullmq';
import * as fs from 'fs';
import { QUEUE_NAME } from '../../../../packages/shared/src/constants';
import { decrypt } from '../../../../packages/shared/src/crypto';
import { PrismaService } from '../prisma.service';

interface NoteJobData {
    saleId: string;
    userId: string;
    externalId: string;
}

@Processor(QUEUE_NAME)
export class NoteEmissionProcessor extends WorkerHost {
    private readonly logger = new Logger(NoteEmissionProcessor.name);
    private readonly prefeituraUrl: string;
    private readonly certSecret: string;
    private readonly webhookUrl: string;
    private readonly webhookTimeout: number;

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {
        super();
        this.prefeituraUrl = this.configService.get<string>(
            'PREFEITURA_MOCK_URL',
            'http://prefeitura-mock:4000/nfse',
        );
        this.certSecret = this.configService.get<string>('CERT_SECRET', '');
        this.webhookUrl = this.configService.get<string>('WEBHOOK_URL', '');
        this.webhookTimeout = this.configService.get<number>(
            'WEBHOOK_TIMEOUT_MS',
            5000,
        );
    }

    /**
     * Processa job de emissão de NFS-e
     */
    async process(job: Job<NoteJobData>): Promise<void> {
        const { saleId, userId, externalId } = job.data;
        const attemptNumber = job.attemptsMade + 1;

        this.logger.log(
            `[Job ${job.id}] Processando emissão - saleId: ${saleId}, tentativa: ${attemptNumber}`,
        );

        try {
            // 1. Verificar idempotência: se já foi processada com sucesso
            const existingNote = await this.prisma.noteEmission.findFirst({
                where: { saleId },
            });

            if (existingNote && existingNote.status === 'SUCCESS') {
                this.logger.warn(
                    `[Job ${job.id}] NFS-e já emitida com sucesso para saleId: ${saleId} (idempotência)`,
                );
                return;
            }

            // 2. Carregar certificado e descriptografar senha
            const certificate = await this.prisma.certificate.findFirst({
                where: { userId },
            });

            if (!certificate) {
                throw new Error(`Certificado não encontrado para userId: ${userId}`);
            }

            if (!fs.existsSync(certificate.filePath)) {
                throw new Error(
                    `Arquivo de certificado não encontrado: ${certificate.filePath}`,
                );
            }

            const certPassword = decrypt(
                certificate.encryptedPassword,
                certificate.iv,
                certificate.authTag,
                this.certSecret,
            );

            this.logger.debug(
                `[Job ${job.id}] Certificado carregado e senha descriptografada`,
            );

            // 3. Montar XML simplificado
            const sale = await this.prisma.sale.findUnique({
                where: { id: saleId },
            });

            if (!sale) {
                throw new Error(`Venda não encontrada: ${saleId}`);
            }

            const xml = this.buildXml(sale, certPassword);

            // 4. Atualizar status para PROCESSING
            await this.prisma.noteEmission.update({
                where: { saleId },
                data: {
                    status: 'PROCESSING',
                    xmlSent: xml,
                    attempts: attemptNumber,
                },
            });

            // 5. Chamar prefeitura mock
            this.logger.log(
                `[Job ${job.id}] Enviando XML para prefeitura: ${this.prefeituraUrl}`,
            );

            const response = await axios.post(this.prefeituraUrl, xml, {
                headers: { 'Content-Type': 'application/xml' },
                timeout: 30000,
                validateStatus: () => true, // Aceitar qualquer status
            });

            const xmlResponse = response.data;

            // 6. Processar resposta
            if (response.status === 200 && this.isSuccess(xmlResponse)) {
                const protocol = this.extractProtocol(xmlResponse);

                // Sucesso: atualizar note e sale
                await this.prisma.noteEmission.update({
                    where: { saleId },
                    data: {
                        status: 'SUCCESS',
                        protocol,
                        xmlResponse: String(xmlResponse),
                        processedAt: new Date(),
                        attempts: attemptNumber,
                    },
                });

                await this.prisma.sale.update({
                    where: { id: saleId },
                    data: { status: 'COMPLETED' },
                });

                this.logger.log(
                    `[Job ${job.id}] ✅ NFS-e emitida com sucesso - Protocolo: ${protocol}`,
                );

                // Disparar webhook de sucesso
                await this.sendWebhook({
                    event: 'NOTE_EMITTED',
                    noteId: existingNote?.id || '',
                    saleId,
                    externalId,
                    status: 'SUCCESS',
                    protocol,
                    errorMessage: null,
                    timestamp: new Date().toISOString(),
                });
            } else {
                const errorMessage = this.extractErrorMessage(xmlResponse);

                // Erro: atualizar note
                await this.prisma.noteEmission.update({
                    where: { saleId },
                    data: {
                        status: 'ERROR',
                        xmlResponse: String(xmlResponse),
                        errorMessage,
                        attempts: attemptNumber,
                    },
                });

                await this.prisma.sale.update({
                    where: { id: saleId },
                    data: { status: 'FAILED' },
                });

                this.logger.error(
                    `[Job ${job.id}] ❌ Erro na emissão: ${errorMessage}`,
                );

                // Disparar webhook de erro
                await this.sendWebhook({
                    event: 'NOTE_FAILED',
                    noteId: existingNote?.id || '',
                    saleId,
                    externalId,
                    status: 'ERROR',
                    protocol: null,
                    errorMessage,
                    timestamp: new Date().toISOString(),
                });

                // Lançar erro para BullMQ fazer retry
                throw new Error(`Emissão falhou: ${errorMessage}`);
            }
        } catch (error) {
            const errMsg = (error as Error).message;
            this.logger.error(
                `[Job ${job.id}] Erro no processamento: ${errMsg}`,
                (error as Error).stack,
            );

            // Atualizar attempts no banco se não foi atualizado
            try {
                await this.prisma.noteEmission.update({
                    where: { saleId },
                    data: {
                        status: 'ERROR',
                        errorMessage: errMsg,
                        attempts: attemptNumber,
                    },
                });
            } catch {
                // Ignora se não conseguir atualizar
            }

            throw error; // Re-throw para BullMQ fazer retry
        }
    }

    /**
     * Monta XML simplificado formato ABRASF para envio à prefeitura
     */
    private buildXml(
        sale: { id: string; tomakerName: string; tomakerDocument: string; tomakerEmail: string; serviceDescription: string; amount: unknown },
        _certPassword: string,
    ): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <LoteRps>
    <NumeroLote>1</NumeroLote>
    <ListaRps>
      <Rps>
        <InfDeclaracaoPrestacaoServico>
          <Rps>
            <IdentificacaoRps>
              <Numero>${sale.id}</Numero>
              <Serie>A1</Serie>
              <Tipo>1</Tipo>
            </IdentificacaoRps>
            <DataEmissao>${new Date().toISOString()}</DataEmissao>
            <Status>1</Status>
          </Rps>
          <Servico>
            <Valores>
              <ValorServicos>${sale.amount}</ValorServicos>
            </Valores>
            <Discriminacao>${sale.serviceDescription}</Discriminacao>
          </Servico>
          <TomadorServico>
            <IdentificacaoTomador>
              <CpfCnpj>
                <Cnpj>${sale.tomakerDocument}</Cnpj>
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${sale.tomakerName}</RazaoSocial>
            <Contato>
              <Email>${sale.tomakerEmail}</Email>
            </Contato>
          </TomadorServico>
        </InfDeclaracaoPrestacaoServico>
      </Rps>
    </ListaRps>
  </LoteRps>
  <Signature>
    <!-- Assinatura digital simulada (mock) - Trade-off: em produção seria usado node-forge ou xml-crypto -->
    <SignatureValue>MOCK_SIGNATURE_${Date.now()}</SignatureValue>
  </Signature>
</EnviarLoteRpsEnvio>`;
    }

    /**
     * Verifica se resposta da prefeitura indica sucesso
     */
    private isSuccess(xmlResponse: string): boolean {
        return (
            String(xmlResponse).includes('<Status>1</Status>') &&
            String(xmlResponse).includes('<Protocolo>')
        );
    }

    /**
     * Extrai protocolo da resposta XML
     */
    private extractProtocol(xmlResponse: string): string {
        const match = String(xmlResponse).match(
            /<Protocolo>([^<]+)<\/Protocolo>/,
        );
        return match ? match[1] : `PROTO-${Date.now()}`;
    }

    /**
     * Extrai mensagem de erro da resposta XML
     */
    private extractErrorMessage(xmlResponse: string): string {
        const match = String(xmlResponse).match(
            /<Mensagem>([^<]+)<\/Mensagem>/,
        );
        return match ? match[1] : 'Erro desconhecido na emissão de NFS-e';
    }

    /**
     * Dispara webhook para URL configurada
     */
    private async sendWebhook(payload: Record<string, unknown>): Promise<void> {
        if (!this.webhookUrl) {
            this.logger.debug('Webhook URL não configurada, pulando envio');
            return;
        }

        try {
            this.logger.log(`Enviando webhook para: ${this.webhookUrl}`);
            await axios.post(this.webhookUrl, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: this.webhookTimeout,
            });
            this.logger.log('Webhook enviado com sucesso');
        } catch (error) {
            this.logger.warn(
                `Falha ao enviar webhook: ${(error as Error).message}`,
            );
            // Não lança erro — webhook failure não deve afetar o fluxo principal
        }
    }
}
