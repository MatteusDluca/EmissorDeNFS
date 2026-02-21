import {
    Controller,
    Get,
    Logger,
    NotFoundException,
    Param,
    Post,
    Query,
    Request,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { NotesService } from '../services/notes.service';

@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
    private readonly logger = new Logger(NotesController.name);

    constructor(private readonly notesService: NotesService) { }

    /**
     * GET /notes → Lista todas as notas do usuário autenticado
     */
    @Get()
    async findAll(
        @Request() req: { user: { id: string } },
        @Query('status') status?: string,
    ) {
        this.logger.log(`GET /notes - userId: ${req.user.id}, status: ${status || 'all'}`);
        return this.notesService.findAllByUser(req.user.id, status);
    }

    /**
     * GET /notes/kpi → Agregação de status e financeiro
     */
    @Get('kpi')
    async getKpi(
        @Request() req: { user: { id: string } },
    ) {
        this.logger.log(`GET /notes/kpi - userId: ${req.user.id}`);
        return this.notesService.getKpiSummary(req.user.id);
    }

    /**
     * POST /notes/:id/retry → Reenfileira nfse
     */
    @Post(':id/retry')
    async retryNote(
        @Param('id') id: string,
        @Request() req: { user: { id: string } },
    ) {
        this.logger.log(`POST /notes/${id}/retry - userId: ${req.user.id}`);
        return this.notesService.retryNote(id, req.user.id);
    }

    /**
     * GET /notes/:id → Detalhe de uma nota
     */
    @Get(':id')
    async findOne(
        @Param('id') id: string,
        @Request() req: { user: { id: string } },
    ) {
        this.logger.log(`GET /notes/${id} - userId: ${req.user.id}`);

        const note = await this.notesService.findById(id, req.user.id);
        if (!note) {
            throw new NotFoundException('Nota não encontrada');
        }
        return note;
    }
}
