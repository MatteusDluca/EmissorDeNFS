import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QUEUE_NAME } from '../../../packages/shared/src/constants';
import { PrismaService } from './prisma.service';
import { NoteEmissionProcessor } from './processors/note-emission.processor';

@Global()
@Module({
    imports: [
        // ─── Config ─────────────────────────────────────────────
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env', '../../.env'],
        }),

        // ─── BullMQ ─────────────────────────────────────────────
        BullModule.forRoot({
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
            },
        }),
        BullModule.registerQueue({ name: QUEUE_NAME }),
    ],
    providers: [PrismaService, NoteEmissionProcessor],
    exports: [PrismaService],
})
export class WorkerModule { }
