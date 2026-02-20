import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
    port: parseInt(process.env.API_PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
}));

export const databaseConfig = registerAs('database', () => ({
    url: process.env.DATABASE_URL,
}));

export const redisConfig = registerAs('redis', () => ({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
}));

export const jwtConfig = registerAs('jwt', () => ({
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
}));

export const certConfig = registerAs('cert', () => ({
    secret: process.env.CERT_SECRET,
}));

export const prefeituraConfig = registerAs('prefeitura', () => ({
    url: process.env.PREFEITURA_MOCK_URL,
    timeout: parseInt(process.env.DEFAULT_PREFEITURA_TIMEOUT || '30000', 10),
}));

export const webhookConfig = registerAs('webhook', () => ({
    url: process.env.WEBHOOK_URL || '',
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT_MS || '5000', 10),
}));
