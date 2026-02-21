import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_NAME } from '../../common/shared';
import { NotesController } from './controllers/notes.controller';
import { NotesService } from './services/notes.service';

@Module({
    imports: [
        BullModule.registerQueue({
            name: QUEUE_NAME,
        }),
    ],
    controllers: [NotesController],
    providers: [NotesService],
    exports: [NotesService],
})
export class NotesModule { }
