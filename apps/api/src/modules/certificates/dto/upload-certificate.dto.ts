import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UploadCertificateDto {
    @IsString()
    @IsNotEmpty({ message: 'A senha do certificado é obrigatória' })
    @MinLength(1, { message: 'A senha do certificado não pode estar vazia' })
    password!: string;
}
