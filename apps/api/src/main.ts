import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { CorrelationIdInterceptor } from './common/correlation-id.interceptor';

async function bootstrap(): Promise<void> {
    const logger = new Logger('Bootstrap');

    const app = await NestFactory.create(AppModule, {
        logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);
    const port = configService.get<number>('app.port', 3000);

    // ─── Global Pipes ──────────────────────────────────────────
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // ─── Global Filters ────────────────────────────────────────
    app.useGlobalFilters(new AllExceptionsFilter());

    // ─── Global Interceptors ───────────────────────────────────
    app.useGlobalInterceptors(new CorrelationIdInterceptor());

    // ─── CORS ──────────────────────────────────────────────────
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });

    // ─── Graceful Shutdown ─────────────────────────────────────
    app.enableShutdownHooks();

    await app.listen(port, '0.0.0.0');

    logger.log(`🚀 NFS-e API rodando na porta ${port}`);
    logger.log(`📋 Ambiente: ${configService.get<string>('app.nodeEnv')}`);
}

bootstrap().catch((err) => {
    const logger = new Logger('Bootstrap');
    logger.error('Failed to start API', err);
    process.exit(1);
});
