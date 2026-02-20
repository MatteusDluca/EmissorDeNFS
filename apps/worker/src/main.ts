import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
    const logger = new Logger('WorkerBootstrap');

    // Worker NestJS headless (sem HTTP server)
    const app = await NestFactory.createApplicationContext(WorkerModule, {
        logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    // Graceful shutdown
    app.enableShutdownHooks();

    logger.log('⚙️  NFS-e Worker iniciado com sucesso');
    logger.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
    logger.log(`   Concurrency: ${process.env.WORKER_CONCURRENCY || 3}`);

    // Keep alive
    process.on('SIGTERM', async () => {
        logger.log('Recebido SIGTERM, encerrando worker...');
        await app.close();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        logger.log('Recebido SIGINT, encerrando worker...');
        await app.close();
        process.exit(0);
    });
}

bootstrap().catch((err) => {
    const logger = new Logger('WorkerBootstrap');
    logger.error('Falha ao iniciar Worker', err);
    process.exit(1);
});
