import { InjectQueue } from '@nestjs/bullmq';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import {
    BULLMQ_BACKOFF_DELAY,
    BULLMQ_BACKOFF_TYPE,
    BULLMQ_RETRY_ATTEMPTS,
    QUEUE_JOB_NAME,
    QUEUE_NAME,
} from '../../../common/shared';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { CertificatesService } from '../../certificates/services/certificates.service';
import { CreateSaleDto } from '../dto/create-sale.dto';

@Injectable()
export class SalesService {
    private readonly logger = new Logger(SalesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly certificatesService: CertificatesService,
        @InjectQueue(QUEUE_NAME) private readonly noteQueue: Queue,
    ) { }

    /**
     * Cria uma venda e enfileira para processamento de NFS-e.
     * Implementa idempotência via externalId único.
     */
    async createSale(
        userId: string,
        dto: CreateSaleDto,
    ): Promise<{ id: string; externalId: string; status: string; message: string }> {
        this.logger.log(
            `Criando venda - externalId: ${dto.externalId}, userId: ${userId}`,
        );

        // Verificar se o usuário possui certificado
        const hasCert = await this.certificatesService.hasCertificate(userId);
        if (!hasCert) {
            throw new BadRequestException(
                'Certificado digital não encontrado. Faça upload antes de criar vendas.',
            );
        }

        // Verificar idempotência: se já existe venda com esse externalId
        const existingSale = await this.prisma.sale.findUnique({
            where: { externalId: dto.externalId },
            include: { noteEmission: true },
        });

        if (existingSale) {
            this.logger.warn(
                `Venda já existe para externalId: ${dto.externalId} (idempotência)`,
            );
            throw new ConflictException({
                message: 'Venda já registrada com este externalId (idempotência)',
                saleId: existingSale.id,
                status: existingSale.status,
            });
        }

        // Criar Sale + NoteEmission em transação
        const result = await this.prisma.$transaction(async (tx) => {
            const sale = await tx.sale.create({
                data: {
                    userId,
                    externalId: dto.externalId,
                    tomakerName: dto.tomakerName,
                    tomakerDocument: dto.tomakerDocument,
                    tomakerEmail: dto.tomakerEmail,
                    serviceDescription: dto.serviceDescription,
                    amount: dto.amount,
                    status: 'PROCESSING',
                },
            });

            const note = await tx.noteEmission.create({
                data: {
                    saleId: sale.id,
                    status: 'PENDING',
                    attempts: 0,
                },
            });

            this.logger.log(
                `Sale criada: ${sale.id}, NoteEmission criada: ${note.id}`,
            );

            return { sale, note };
        });

        // Enfileirar job no BullMQ com idempotência via jobId
        try {
            await this.noteQueue.add(
                QUEUE_JOB_NAME,
                {
                    saleId: result.sale.id,
                    userId,
                    externalId: dto.externalId,
                },
                {
                    jobId: dto.externalId, // Idempotência nativa do BullMQ
                    attempts: BULLMQ_RETRY_ATTEMPTS,
                    backoff: {
                        type: BULLMQ_BACKOFF_TYPE,
                        delay: BULLMQ_BACKOFF_DELAY,
                    },
                    removeOnComplete: { age: 86400 }, // 24h
                    removeOnFail: { age: 604800 }, // 7 dias
                },
            );

            this.logger.log(
                `Job enfileirado - jobId: ${dto.externalId}, saleId: ${result.sale.id}`,
            );
        } catch (error) {
            this.logger.error(
                `Erro ao enfileirar job: ${(error as Error).message}`,
                (error as Error).stack,
            );
            // Mesmo se falhar o enqueue, a sale já foi criada
            // O job pode ser reenfileirado manualmente ou via retry
        }

        return {
            id: result.sale.id,
            externalId: dto.externalId,
            status: 'PROCESSING',
            message: 'Venda registrada e enviada para processamento de NFS-e',
        };
    }

    /**
     * Lista vendas do usuário
     */
    async findAllByUser(userId: string) {
        return this.prisma.sale.findMany({
            where: { userId },
            include: { noteEmission: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Busca venda por ID
     */
    async findById(saleId: string, userId: string) {
        return this.prisma.sale.findFirst({
            where: { id: saleId, userId },
            include: { noteEmission: true },
        });
    }
}
