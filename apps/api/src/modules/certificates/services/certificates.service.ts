import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { CERT_UPLOAD_DIR, decrypt, encrypt } from '../../../common/shared';
import { PrismaService } from '../../../infrastructure/prisma.service';

@Injectable()
export class CertificatesService {
    private readonly logger = new Logger(CertificatesService.name);
    private readonly certSecret: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {
        this.certSecret = this.configService.get<string>('cert.secret', '');
        if (!this.certSecret) {
            this.logger.error('CERT_SECRET não configurado!');
        }
    }

    /**
     * Upload de certificado .pfx com criptografia da senha
     */
    async uploadCertificate(
        userId: string,
        file: Express.Multer.File,
        password: string,
    ): Promise<{ id: string; filePath: string; message: string }> {
        this.logger.log(`Iniciando upload de certificado para userId: ${userId}`);

        // Validar extensão do arquivo
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.pfx' && ext !== '.p12') {
            this.logger.warn(`Extensão inválida: ${ext}`);
            throw new BadRequestException(
                'Apenas arquivos .pfx ou .p12 são aceitos',
            );
        }

        // Garantir que o diretório de certificados existe
        const certDir = path.resolve(CERT_UPLOAD_DIR);
        if (!fs.existsSync(certDir)) {
            fs.mkdirSync(certDir, { recursive: true });
            this.logger.debug(`Diretório de certificados criado: ${certDir}`);
        }

        // Salvar arquivo no disco com timestamp pra suportar múltiplos
        const uniqueFileName = `${userId}-${Date.now()}.pfx`;
        const filePath = path.join(certDir, uniqueFileName);
        fs.writeFileSync(filePath, file.buffer);
        this.logger.log(`Certificado salvo em: ${filePath}`);

        // Criptografar senha com AES-256-GCM
        const encryptedData = encrypt(password, this.certSecret);
        this.logger.debug('Senha do certificado criptografada com sucesso');

        // Salvar no banco (Não deletamos mais o antigo para permitir N certificados)
        const certificate = await this.prisma.certificate.create({
            data: {
                userId,
                filePath,
                encryptedPassword: encryptedData.encrypted,
                iv: encryptedData.iv,
                authTag: encryptedData.authTag,
            },
        });

        this.logger.log(`Certificado registrado no banco: ${certificate.id}`);

        return {
            id: certificate.id,
            filePath: certificate.filePath,
            message: 'Certificado enviado e armazenado com segurança',
        };
    }

    /**
     * Busca certificado do usuário e descriptografa a senha (Usa sempre o mais recente)
     */
    async getCertificateWithPassword(
        userId: string,
    ): Promise<{ filePath: string; password: string }> {
        const certificate = await this.prisma.certificate.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });

        if (!certificate) {
            throw new NotFoundException(
                'Certificado não encontrado. Faça upload primeiro.',
            );
        }

        // Verificar se o arquivo existe no disco
        if (!fs.existsSync(certificate.filePath)) {
            this.logger.error(
                `Arquivo de certificado não encontrado: ${certificate.filePath}`,
            );
            throw new NotFoundException(
                'Arquivo de certificado não encontrado no disco',
            );
        }

        // Descriptografar senha
        const password = decrypt(
            certificate.encryptedPassword,
            certificate.iv,
            certificate.authTag,
            this.certSecret,
        );

        return {
            filePath: certificate.filePath,
            password,
        };
    }

    /**
     * Recupera todos os certificados listados deste usuário
     */
    async findAllByUserId(userId: string) {
        const certs = await this.prisma.certificate.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });

        return certs.map(c => ({
            id: c.id,
            createdAt: c.createdAt,
            // Apenas para display na UI
            fileName: path.basename(c.filePath),
            // Indicar se é o mais recente pra worker:
            isLatest: certs[0].id === c.id
        }));
    }

    /**
     * Verifica se o usuário possui certificado cadastrado
     */
    async hasCertificate(userId: string): Promise<boolean> {
        const count = await this.prisma.certificate.count({
            where: { userId },
        });
        return count > 0;
    }
}
