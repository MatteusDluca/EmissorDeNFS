import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { BULLMQ_BACKOFF_DELAY, BULLMQ_BACKOFF_TYPE, BULLMQ_RETRY_ATTEMPTS, QUEUE_JOB_NAME, QUEUE_NAME } from '../../../common/shared';
import { PrismaService } from '../../../infrastructure/prisma.service';

@Injectable()
export class NotesService {
    private readonly logger = new Logger(NotesService.name);

    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue(QUEUE_NAME) private readonly noteQueue: Queue,
    ) { }

    /**
     * Lista todas as notas de emissão do usuário com filtro opcional por status
     */
    async findAllByUser(userId: string, status?: string) {
        this.logger.debug(`Buscando notas - userId: ${userId}, status: ${status || 'all'}`);

        const where: Record<string, unknown> = {
            sale: { userId },
        };

        if (status) {
            where.status = status;
        }

        const notes = await this.prisma.noteEmission.findMany({
            where,
            include: {
                sale: {
                    select: {
                        id: true,
                        externalId: true,
                        tomakerName: true,
                        tomakerDocument: true,
                        serviceDescription: true,
                        amount: true,
                        status: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return {
            total: notes.length,
            notes: notes.map((note) => ({
                id: note.id,
                saleId: note.saleId,
                externalId: note.sale.externalId,
                status: note.status,
                protocol: note.protocol,
                errorMessage: note.errorMessage,
                attempts: note.attempts,
                processedAt: note.processedAt,
                createdAt: note.createdAt,
                sale: note.sale,
            })),
        };
    }

    /**
     * Busca nota por ID verificando que pertence ao usuário
     */
    async findById(noteId: string, userId: string) {
        const note = await this.prisma.noteEmission.findFirst({
            where: {
                id: noteId,
                sale: { userId },
            },
            include: {
                sale: true,
            },
        });

        if (!note) {
            return null;
        }

        return {
            id: note.id,
            saleId: note.saleId,
            externalId: note.sale.externalId,
            status: note.status,
            protocol: note.protocol,
            xmlSent: note.xmlSent,
            xmlResponse: note.xmlResponse,
            errorMessage: note.errorMessage,
            attempts: note.attempts,
            processedAt: note.processedAt,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            sale: {
                id: note.sale.id,
                externalId: note.sale.externalId,
                tomakerName: note.sale.tomakerName,
                tomakerDocument: note.sale.tomakerDocument,
                tomakerEmail: note.sale.tomakerEmail,
                serviceDescription: note.sale.serviceDescription,
                amount: note.sale.amount,
                status: note.sale.status,
            },
        };
    }

    /**
     * Agrega dados financeiros (KPI) das notas de um usuário
     */
    async getKpiSummary(userId: string) {
        // Encontra o amount somado de todas as sales desse userId
        const salesAgg = await this.prisma.sale.aggregate({
            where: { userId },
            _sum: { amount: true },
        });

        const statusGroup = await this.prisma.noteEmission.groupBy({
            by: ['status'],
            where: { sale: { userId } },
            _count: true,
        });

        let successCount = 0;
        let errorCount = 0;
        let processingCount = 0;

        for (const item of statusGroup) {
            if (item.status === 'SUCCESS') successCount += item._count;
            if (item.status === 'ERROR') errorCount += item._count;
            if (item.status === 'PROCESSING' || item.status === 'PENDING') processingCount += item._count;
        }

        return {
            totalAmount: Number(salesAgg._sum.amount || 0),
            totalSuccess: successCount,
            totalFailed: errorCount,
            totalProcessing: processingCount,
        };
    }

    /**
     * Tenta reenviar uma NFSe que falhou anteriormente
     */
    async retryNote(noteId: string, userId: string) {
        const note = await this.prisma.noteEmission.findFirst({
            where: { id: noteId, sale: { userId } },
            include: { sale: true },
        });

        if (!note) {
            throw new Error('Nota não encontrada');
        }

        if (note.status !== 'ERROR') {
            throw new Error(`Apenas notas com falha podem ser reprocessadas. Status atual: ${note.status}`);
        }

        // Volta status para pending e zera attempts
        await this.prisma.$transaction([
            this.prisma.noteEmission.update({
                where: { id: note.id },
                data: { status: 'PENDING', attempts: 0, errorMessage: null },
            }),
            this.prisma.sale.update({
                where: { id: note.saleId },
                data: { status: 'PROCESSING' },
            })
        ]);

        try {
            // Removido da fila com id antigo pra forçar bypass. Enviamos novo JobId.
            const uniqueJobId = `${note.sale.externalId}-${Date.now()}`;
            await this.noteQueue.add(
                QUEUE_JOB_NAME,
                {
                    saleId: note.saleId,
                    userId,
                    externalId: note.sale.externalId,
                },
                {
                    jobId: uniqueJobId,
                    attempts: BULLMQ_RETRY_ATTEMPTS,
                    backoff: {
                        type: BULLMQ_BACKOFF_TYPE,
                        delay: BULLMQ_BACKOFF_DELAY,
                    },
                    removeOnComplete: { age: 86400 },
                    removeOnFail: { age: 604800 },
                },
            );

            this.logger.log(`Job reenfileirado manualmente - jobId: ${uniqueJobId}`);
        } catch (error) {
            this.logger.error(`Erro ao reenfileirar job: ${(error as Error).message}`);
            throw new Error('Falha ao acionar a fila de processamento');
        }

        return { message: 'Nota reenfileirada com sucesso para nova tentativa' };
    }
}
