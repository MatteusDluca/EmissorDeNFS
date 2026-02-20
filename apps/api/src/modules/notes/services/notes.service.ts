import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';

@Injectable()
export class NotesService {
    private readonly logger = new Logger(NotesService.name);

    constructor(private readonly prisma: PrismaService) { }

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
}
