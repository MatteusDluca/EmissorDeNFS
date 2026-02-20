import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './common/health.controller';
import {
    appConfig,
    certConfig,
    databaseConfig,
    jwtConfig,
    prefeituraConfig,
    redisConfig,
    webhookConfig,
} from './config/app.config';
import { validationSchema } from './config/validation.schema';
import { PrismaModule } from './infrastructure/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CertificatesModule } from './modules/certificates/certificates.module';

@Module({
    imports: [
        // ─── Config Module ──────────────────────────────────────
        ConfigModule.forRoot({
            isGlobal: true,
            validationSchema,
            load: [
                appConfig,
                databaseConfig,
                redisConfig,
                jwtConfig,
                certConfig,
                prefeituraConfig,
                webhookConfig,
            ],
            envFilePath: ['.env', '../../.env'],
        }),

        // ─── BullMQ ─────────────────────────────────────────────
        BullModule.forRoot({
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
            },
        }),

        // ─── Database ───────────────────────────────────────────
        PrismaModule,

        // ─── Feature Modules ────────────────────────────────────
        AuthModule,
        CertificatesModule,
    ],
    controllers: [HealthController],
    providers: [],
})
export class AppModule { }
