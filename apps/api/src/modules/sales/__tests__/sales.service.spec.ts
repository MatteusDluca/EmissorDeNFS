import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { QUEUE_NAME } from '../../../common/shared';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { CertificatesService } from '../../certificates/services/certificates.service';
import { SalesService } from '../services/sales.service';

describe('SalesService', () => {
    let service: SalesService;

    const mockPrisma = {
        sale: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
        },
        $transaction: jest.fn(),
    };

    const mockCertificatesService = {
        hasCertificate: jest.fn(),
    };

    const mockQueue = {
        add: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SalesService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CertificatesService, useValue: mockCertificatesService },
                { provide: getQueueToken(QUEUE_NAME), useValue: mockQueue },
            ],
        }).compile();

        service = module.get<SalesService>(SalesService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createSale', () => {
        const createDto = {
            externalId: 'ext-001',
            tomakerName: 'Empresa XYZ',
            tomakerDocument: '12345678901234',
            tomakerEmail: 'contato@xyz.com',
            serviceDescription: 'Serviço de consultoria',
            amount: 1500.0,
        };

        it('deve criar venda e enfileirar job', async () => {
            mockCertificatesService.hasCertificate.mockResolvedValue(true);
            mockPrisma.sale.findUnique.mockResolvedValue(null);
            mockPrisma.$transaction.mockResolvedValue({
                sale: { id: 'sale-1', status: 'PROCESSING' },
                note: { id: 'note-1' },
            });
            mockQueue.add.mockResolvedValue({});

            const result = await service.createSale('user-1', createDto);

            expect(result.id).toBe('sale-1');
            expect(result.status).toBe('PROCESSING');
            expect(mockQueue.add).toHaveBeenCalled();
        });

        it('deve rejeitar quando certificado não existe', async () => {
            mockCertificatesService.hasCertificate.mockResolvedValue(false);

            await expect(
                service.createSale('user-1', createDto),
            ).rejects.toThrow(BadRequestException);
        });

        it('deve rejeitar por idempotência quando externalId já existe', async () => {
            mockCertificatesService.hasCertificate.mockResolvedValue(true);
            mockPrisma.sale.findUnique.mockResolvedValue({
                id: 'existing-sale',
                externalId: 'ext-001',
                status: 'COMPLETED',
            });

            await expect(
                service.createSale('user-1', createDto),
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('findAllByUser', () => {
        it('deve listar vendas do usuário', async () => {
            const mockSales = [
                { id: 'sale-1', externalId: 'ext-001', status: 'COMPLETED' },
                { id: 'sale-2', externalId: 'ext-002', status: 'PROCESSING' },
            ];

            mockPrisma.sale.findMany.mockResolvedValue(mockSales);

            const result = await service.findAllByUser('user-1');

            expect(result).toHaveLength(2);
            expect(mockPrisma.sale.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'user-1' },
                }),
            );
        });
    });
});
