import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { CertificatesService } from '../services/certificates.service';

// Mock crypto e fs
jest.mock('../../../../../packages/shared/src/crypto', () => ({
    encrypt: jest.fn().mockReturnValue({
        encrypted: 'encrypted_password',
        iv: 'mock_iv',
        authTag: 'mock_auth_tag',
    }),
    decrypt: jest.fn().mockReturnValue('decrypted_password'),
}));

jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
}));

describe('CertificatesService', () => {
    let service: CertificatesService;

    const mockPrisma = {
        certificate: {
            findFirst: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
        },
    };

    const mockConfigService = {
        get: jest.fn().mockReturnValue('test_cert_secret'),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CertificatesService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        service = module.get<CertificatesService>(CertificatesService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('uploadCertificate', () => {
        const mockFile = {
            originalname: 'cert.pfx',
            buffer: Buffer.from('fake_cert'),
            size: 1000,
        } as Express.Multer.File;

        it('deve fazer upload e criptografar senha do certificado', async () => {
            mockPrisma.certificate.findFirst.mockResolvedValue(null);
            mockPrisma.certificate.create.mockResolvedValue({
                id: 'cert-1',
                userId: 'user-1',
                filePath: '/certs/user-1.pfx',
            });

            const result = await service.uploadCertificate(
                'user-1',
                mockFile,
                'cert_password',
            );

            expect(result.id).toBe('cert-1');
            expect(result.message).toContain('segurança');
            expect(mockPrisma.certificate.create).toHaveBeenCalled();
        });

        it('deve rejeitar arquivo com extensão inválida', async () => {
            const invalidFile = {
                originalname: 'cert.txt',
                buffer: Buffer.from('fake'),
            } as Express.Multer.File;

            await expect(
                service.uploadCertificate('user-1', invalidFile, 'password'),
            ).rejects.toThrow(BadRequestException);
        });

        it('deve substituir certificado existente', async () => {
            mockPrisma.certificate.findFirst.mockResolvedValue({
                id: 'old-cert',
                userId: 'user-1',
            });
            mockPrisma.certificate.delete.mockResolvedValue({});
            mockPrisma.certificate.create.mockResolvedValue({
                id: 'new-cert',
                userId: 'user-1',
                filePath: '/certs/user-1.pfx',
            });

            const result = await service.uploadCertificate(
                'user-1',
                mockFile,
                'new_password',
            );

            expect(result.id).toBe('new-cert');
            expect(mockPrisma.certificate.delete).toHaveBeenCalledWith({
                where: { id: 'old-cert' },
            });
        });
    });

    describe('hasCertificate', () => {
        it('deve retornar true quando certificado existe', async () => {
            mockPrisma.certificate.count.mockResolvedValue(1);
            const result = await service.hasCertificate('user-1');
            expect(result).toBe(true);
        });

        it('deve retornar false quando certificado não existe', async () => {
            mockPrisma.certificate.count.mockResolvedValue(0);
            const result = await service.hasCertificate('user-1');
            expect(result).toBe(false);
        });
    });
});
