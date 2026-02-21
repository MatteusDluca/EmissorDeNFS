import {
    BadRequestException,
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Logger,
    Post,
    Request,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MAX_CERT_FILE_SIZE } from '../../../common/shared';
import { UploadCertificateDto } from '../dto/upload-certificate.dto';
import { CertificatesService } from '../services/certificates.service';

@Controller('certificates')
@UseGuards(JwtAuthGuard)
export class CertificatesController {
    private readonly logger = new Logger(CertificatesController.name);

    constructor(private readonly certificatesService: CertificatesService) { }

    @Post('upload')
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: MAX_CERT_FILE_SIZE },
            fileFilter: (_req, file, callback) => {
                const ext = file.originalname.toLowerCase();
                if (!ext.endsWith('.pfx') && !ext.endsWith('.p12')) {
                    return callback(
                        new BadRequestException('Apenas arquivos .pfx ou .p12 são aceitos'),
                        false,
                    );
                }
                callback(null, true);
            },
        }),
    )
    async upload(
        @UploadedFile() file: Express.Multer.File,
        @Body() dto: UploadCertificateDto,
        @Request() req: { user: { id: string; username: string } },
    ) {
        if (!file) {
            throw new BadRequestException('Arquivo de certificado (.pfx) é obrigatório');
        }

        this.logger.log(`Upload de certificado por usuário: ${req.user.username}`);

        return this.certificatesService.uploadCertificate(
            req.user.id,
            file,
            dto.password,
        );
    }
}
