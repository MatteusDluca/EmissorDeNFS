import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../infrastructure/prisma.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) { }

    async validateUser(username: string, password: string): Promise<{ id: string; username: string }> {
        this.logger.debug(`Validando credenciais para usuário: ${username}`);

        const user = await this.prisma.user.findUnique({
            where: { username },
        });

        if (!user) {
            this.logger.warn(`Usuário não encontrado: ${username}`);
            throw new UnauthorizedException('Credenciais inválidas');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            this.logger.warn(`Senha inválida para usuário: ${username}`);
            throw new UnauthorizedException('Credenciais inválidas');
        }

        this.logger.log(`Usuário autenticado com sucesso: ${username}`);
        return { id: user.id, username: user.username };
    }

    async login(user: { id: string; username: string }): Promise<{ accessToken: string; tokenType: string; expiresIn: string }> {
        const payload = { sub: user.id, username: user.username };

        const accessToken = this.jwtService.sign(payload);

        this.logger.log(`Token JWT gerado para usuário: ${user.username}`);

        return {
            accessToken,
            tokenType: 'Bearer',
            expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        };
    }
}
