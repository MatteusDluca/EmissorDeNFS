import * as Joi from 'joi';

export const validationSchema = Joi.object({
    // PostgreSQL
    DATABASE_URL: Joi.string().uri().required(),

    // Redis
    REDIS_HOST: Joi.string().default('localhost'),
    REDIS_PORT: Joi.number().default(6379),

    // JWT
    JWT_SECRET: Joi.string().min(16).required(),
    JWT_EXPIRES_IN: Joi.string().default('24h'),

    // Certificate Security
    CERT_SECRET: Joi.string().min(16).required(),

    // Prefeitura Mock
    PREFEITURA_MOCK_URL: Joi.string().uri().required(),

    // Webhook
    WEBHOOK_URL: Joi.string().uri().allow('').optional(),
    WEBHOOK_TIMEOUT_MS: Joi.number().default(5000),

    // API
    API_PORT: Joi.number().default(3000),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

    // Worker
    WORKER_CONCURRENCY: Joi.number().default(3),

    // Admin Seed
    ADMIN_USERNAME: Joi.string().default('admin'),
    ADMIN_PASSWORD: Joi.string().default('admin'),
});
