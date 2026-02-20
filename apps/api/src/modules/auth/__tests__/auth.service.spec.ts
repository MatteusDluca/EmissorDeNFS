import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AuthService } from '../services/auth.service';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
    let service: AuthService;
    let prisma: PrismaService;
    let jwtService: JwtService;

    const mockPrisma = {
        user: {
            findUnique: jest.fn(),
        },
    };

    const mockJwtService = {
        sign: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: JwtService, useValue: mockJwtService },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        prisma = module.get<PrismaService>(PrismaService);
        jwtService = module.get<JwtService>(JwtService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('validateUser', () => {
        it('deve retornar usuário quando credenciais válidas', async () => {
            const mockUser = {
                id: 'uuid-1',
                username: 'admin',
                password: '$2b$10$hashedpassword',
            };

            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const result = await service.validateUser('admin', 'admin123');

            expect(result).toEqual({ id: 'uuid-1', username: 'admin' });
            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { username: 'admin' },
            });
        });

        it('deve lançar UnauthorizedException quando usuário não existe', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            await expect(
                service.validateUser('nonexistent', 'password'),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('deve lançar UnauthorizedException quando senha inválida', async () => {
            const mockUser = {
                id: 'uuid-1',
                username: 'admin',
                password: '$2b$10$hashedpassword',
            };

            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(
                service.validateUser('admin', 'wrongpassword'),
            ).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('login', () => {
        it('deve retornar token JWT válido', async () => {
            mockJwtService.sign.mockReturnValue('mock.jwt.token');

            const result = await service.login({
                id: 'uuid-1',
                username: 'admin',
            });

            expect(result).toEqual({
                accessToken: 'mock.jwt.token',
                tokenType: 'Bearer',
                expiresIn: expect.any(String),
            });

            expect(mockJwtService.sign).toHaveBeenCalledWith({
                sub: 'uuid-1',
                username: 'admin',
            });
        });
    });
});
