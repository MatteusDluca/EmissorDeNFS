// ─── Queue Names ───────────────────────────────────────────────
export const QUEUE_NAME = 'note-emission';
export const QUEUE_JOB_NAME = 'process-note';

// ─── Crypto ────────────────────────────────────────────────────
export const CRYPTO_ALGORITHM = 'aes-256-gcm';
export const CRYPTO_KEY_LENGTH = 32;
export const CRYPTO_IV_LENGTH = 16;

// ─── HTTP ──────────────────────────────────────────────────────
export const DEFAULT_WEBHOOK_TIMEOUT = 5000;
export const DEFAULT_PREFEITURA_TIMEOUT = 30000;

// ─── BullMQ ────────────────────────────────────────────────────
export const BULLMQ_RETRY_ATTEMPTS = 3;
export const BULLMQ_BACKOFF_TYPE = 'exponential';
export const BULLMQ_BACKOFF_DELAY = 1000;

// ─── Misc ──────────────────────────────────────────────────────
export const CERT_UPLOAD_DIR = './certs';
export const MAX_CERT_FILE_SIZE = 10 * 1024 * 1024; // 10MB
