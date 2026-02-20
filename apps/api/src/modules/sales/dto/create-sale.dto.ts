import {
    IsEmail,
    IsNotEmpty,
    IsNumber,
    IsPositive,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateSaleDto {
    @IsString()
    @IsNotEmpty({ message: 'O externalId é obrigatório para idempotência' })
    @MinLength(1)
    @MaxLength(255)
    externalId!: string;

    @IsString()
    @IsNotEmpty({ message: 'O nome do tomador é obrigatório' })
    @MinLength(2)
    @MaxLength(255)
    tomakerName!: string;

    @IsString()
    @IsNotEmpty({ message: 'O documento do tomador é obrigatório' })
    @MinLength(11, { message: 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos' })
    @MaxLength(14)
    tomakerDocument!: string;

    @IsEmail({}, { message: 'Email do tomador inválido' })
    @IsNotEmpty()
    tomakerEmail!: string;

    @IsString()
    @IsNotEmpty({ message: 'A descrição do serviço é obrigatória' })
    @MinLength(5)
    @MaxLength(2000)
    serviceDescription!: string;

    @IsNumber({}, { message: 'O valor deve ser numérico' })
    @IsPositive({ message: 'O valor deve ser positivo' })
    amount!: number;
}
