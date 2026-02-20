import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_NAME } from '../../../../../packages/shared/src/constants';
import { CertificatesModule } from '../certificates/certificates.module';
import { SalesController } from './controllers/sales.controller';
import { SalesService } from './services/sales.service';

@Module({
    imports: [
        BullModule.registerQueue({ name: QUEUE_NAME }),
        CertificatesModule,
    ],
    controllers: [SalesController],
    providers: [SalesService],
    exports: [SalesService],
})
export class SalesModule { }
