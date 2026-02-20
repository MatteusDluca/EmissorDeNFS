import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface WebhookPayload {
    event: string;
    noteId: string;
    saleId: string;
    externalId: string;
    status: string;
    protocol: string | null;
    errorMessage: string | null;
    timestamp: string;
}

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);
    private readonly webhookUrl: string;
    private readonly webhookTimeout: number;

    constructor(private readonly configService: ConfigService) {
        this.webhookUrl = this.configService.get<string>('webhook.url', '');
        this.webhookTimeout = this.configService.get<number>(
            'webhook.timeout',
            5000,
        );
    }

    /**
     * Dispara webhook para URL configurada
     */
    async send(payload: WebhookPayload): Promise<boolean> {
        if (!this.webhookUrl) {
            this.logger.debug('Webhook URL não configurada, pulando envio');
            return false;
        }

        try {
            this.logger.log(
                `Enviando webhook para: ${this.webhookUrl} - evento: ${payload.event}`,
            );

            await axios.post(this.webhookUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Event': payload.event,
                    'X-Webhook-Timestamp': payload.timestamp,
                },
                timeout: this.webhookTimeout,
            });

            this.logger.log(`✅ Webhook enviado com sucesso - evento: ${payload.event}`);
            return true;
        } catch (error) {
            this.logger.warn(
                `❌ Falha ao enviar webhook: ${(error as Error).message}`,
            );
            // Webhook failure não deve afetar o fluxo principal
            return false;
        }
    }
}
