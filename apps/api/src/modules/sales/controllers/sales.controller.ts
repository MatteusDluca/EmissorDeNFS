import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Logger,
    NotFoundException,
    Param,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateSaleDto } from '../dto/create-sale.dto';
import { SalesService } from '../services/sales.service';

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
    private readonly logger = new Logger(SalesController.name);

    constructor(private readonly salesService: SalesService) { }

    /**
     * POST /sales → 202 Accepted
     * Cria venda e enfileira para processamento de NFS-e
     */
    @Post()
    @HttpCode(HttpStatus.ACCEPTED)
    async create(
        @Body() dto: CreateSaleDto,
        @Request() req: { user: { id: string; username: string } },
    ) {
        this.logger.log(
            `POST /sales - externalId: ${dto.externalId}, user: ${req.user.username}`,
        );

        return this.salesService.createSale(req.user.id, dto);
    }

    /**
     * GET /sales → Lista vendas do usuário autenticado
     */
    @Get()
    async findAll(@Request() req: { user: { id: string } }) {
        return this.salesService.findAllByUser(req.user.id);
    }

    /**
     * GET /sales/:id → Detalhe de uma venda
     */
    @Get(':id')
    async findOne(
        @Param('id') id: string,
        @Request() req: { user: { id: string } },
    ) {
        const sale = await this.salesService.findById(id, req.user.id);
        if (!sale) {
            throw new NotFoundException('Venda não encontrada');
        }
        return sale;
    }
}
