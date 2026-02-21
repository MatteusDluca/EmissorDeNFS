import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma.service';
import { NoteEmissionProcessor } from '../processors/note-emission.processor';

describe('NoteEmissionProcessor', () => {
    let processor: NoteEmissionProcessor;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NoteEmissionProcessor,
                {
                    // Mockando Prisma ORM Database
                    provide: PrismaService,
                    useValue: {
                        sale: { update: jest.fn(), findUnique: jest.fn() },
                        noteEmission: { update: jest.fn() },
                        certificate: { findFirst: jest.fn() },
                    },
                },
                {
                    // Mockando Variáveis de Ambiente
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
                            if (key === 'PREFEITURA_MOCK_URL') return 'http://mock.prefeitura.com/api';
                            if (key === 'CERT_SECRET') return 'supersecretkey123';
                            if (key === 'WEBHOOK_URL') return 'http://mock.webhook.com/api';
                            return defaultValue;
                        }),
                    },
                }
            ],
        }).compile();

        processor = module.get<NoteEmissionProcessor>(NoteEmissionProcessor);
    });

    it('should be defined', () => {
        expect(processor).toBeDefined();
    });

    it('should expose a process method for BullMQ', () => {
        expect(typeof processor.process).toBe('function');
    });
});
