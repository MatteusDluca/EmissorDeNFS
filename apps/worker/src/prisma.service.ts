import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    async onModuleInit(): Promise<void> {
        this.logger.log('[Worker] Connecting to PostgreSQL...');
        await this.$connect();
        this.logger.log('[Worker] PostgreSQL connected');
    }

    async onModuleDestroy(): Promise<void> {
        this.logger.log('[Worker] Disconnecting from PostgreSQL...');
        await this.$disconnect();
    }
}
