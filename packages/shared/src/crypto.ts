import * as crypto from 'crypto';
import {
    CRYPTO_ALGORITHM,
    CRYPTO_IV_LENGTH,
    CRYPTO_KEY_LENGTH,
} from './constants';

/**
 * Resultado da criptografia AES-256-GCM
 */
export interface EncryptedData {
    /** Dados criptografados em hex */
    encrypted: string;
    /** Vetor de inicialização em hex */
    iv: string;
    /** Tag de autenticação em hex */
    authTag: string;
}

/**
 * Deriva uma chave de 32 bytes a partir do secret usando SHA-256.
 * Garante que qualquer string de input resulte em exatamente 32 bytes.
 */
function deriveKey(secret: string): Buffer {
    return crypto.createHash('sha256').update(secret).digest().subarray(0, CRYPTO_KEY_LENGTH);
}

/**
 * Criptografa uma string usando AES-256-GCM.
 *
 * @param plaintext - Texto a ser criptografado (ex: senha do certificado)
 * @param secret - Chave secreta (CERT_SECRET do env)
 * @returns Objeto com encrypted, iv e authTag em formato hex
 *
 * @example
 * ```typescript
 * const result = encrypt('minha-senha-pfx', process.env.CERT_SECRET!);
 * // { encrypted: 'a1b2c3...', iv: 'd4e5f6...', authTag: 'g7h8i9...' }
 * ```
 */
export function encrypt(plaintext: string, secret: string): EncryptedData {
    const key = deriveKey(secret);
    const iv = crypto.randomBytes(CRYPTO_IV_LENGTH);

    const cipher = crypto.createCipheriv(CRYPTO_ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag,
    };
}

/**
 * Descriptografa dados criptografados com AES-256-GCM.
 *
 * @param encryptedData - Dados criptografados (hex)
 * @param iv - Vetor de inicialização (hex)
 * @param authTag - Tag de autenticação (hex)
 * @param secret - Chave secreta (CERT_SECRET do env)
 * @returns Texto descriptografado
 *
 * @example
 * ```typescript
 * const password = decrypt(cert.encryptedPassword, cert.iv, cert.authTag, process.env.CERT_SECRET!);
 * ```
 */
export function decrypt(
    encryptedData: string,
    iv: string,
    authTag: string,
    secret: string,
): string {
    const key = deriveKey(secret);
    const ivBuffer = Buffer.from(iv, 'hex');
    const authTagBuffer = Buffer.from(authTag, 'hex');

    const decipher = crypto.createDecipheriv(CRYPTO_ALGORITHM, key, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
