/**
 * Constantes e utilitários compartilhados — cópia local para evitar
 * problemas de rootDir no build TypeScript.
 * Fonte original: packages/shared/src/constants.ts + crypto.ts
 */
import * as crypto from 'crypto';

// ─── Queue Constants ────────────────────────────────────────────
export const QUEUE_NAME = 'note-emission';
export const QUEUE_JOB_NAME = 'process-note';
export const BULLMQ_RETRY_ATTEMPTS = 3;
export const BULLMQ_BACKOFF_TYPE = 'exponential' as const;
export const BULLMQ_BACKOFF_DELAY = 2000;

// ─── Crypto Constants ───────────────────────────────────────────
export const CRYPTO_ALGORITHM = 'aes-256-gcm';
export const CRYPTO_KEY_LENGTH = 32;
export const CRYPTO_IV_LENGTH = 16;

// ─── Certificate Constants ──────────────────────────────────────
export const CERT_UPLOAD_DIR = './certs';
export const MAX_CERT_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Timeout Constants ──────────────────────────────────────────
export const WEBHOOK_DEFAULT_TIMEOUT = 5000;
export const PREFEITURA_DEFAULT_TIMEOUT = 30000;

// ─── Crypto Functions ───────────────────────────────────────────

export function deriveKey(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex').slice(0, 64);
}

export interface EncryptResult {
    encrypted: string;
    iv: string;
    authTag: string;
}

export function encrypt(plaintext: string, secret: string): EncryptResult {
    const keyHex = deriveKey(secret);
    const key = Buffer.from(keyHex, 'hex');
    const iv = crypto.randomBytes(CRYPTO_IV_LENGTH);

    const cipher = crypto.createCipheriv(CRYPTO_ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = (cipher as crypto.CipherGCM).getAuthTag().toString('hex');

    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag,
    };
}

export function decrypt(
    encryptedText: string,
    ivHex: string,
    authTagHex: string,
    secret: string,
): string {
    const keyHex = deriveKey(secret);
    const key = Buffer.from(keyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipheriv(CRYPTO_ALGORITHM, key, iv);
    (decipher as crypto.DecipherGCM).setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
