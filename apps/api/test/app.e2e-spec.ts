import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
const request = require('supertest');

/**
 * Testes E2E (end-to-end) da API NFS-e
 * Executar com: npm run test:e2e
 * Requer banco de dados e Redis rodando
 */
describe('API E2E Tests', () => {
    let app: INestApplication;
    let authToken: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    describe('Health Check', () => {
        it('GET /health → 200', () => {
            return request(app.getHttpServer())
                .get('/health')
                .expect(200)
                .expect((res: any) => {
                    expect(res.body).toHaveProperty('status', 'ok');
                    expect(res.body).toHaveProperty('service', 'nfse-api');
                });
        });
    });

    describe('Auth', () => {
        it('POST /auth/login com credenciais inválidas → 401', () => {
            return request(app.getHttpServer())
                .post('/auth/login')
                .send({ username: 'invalid', password: 'wrong' })
                .expect(401);
        });

        it('POST /auth/login com body inválido → 400', () => {
            return request(app.getHttpServer())
                .post('/auth/login')
                .send({ username: '' })
                .expect(400);
        });

        it('POST /auth/login com credenciais válidas → 200', async () => {
            const response = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ username: 'admin', password: 'admin123' })
                .expect(200);

            expect(response.body).toHaveProperty('accessToken');
            expect(response.body).toHaveProperty('tokenType', 'Bearer');
            authToken = response.body.accessToken;
        });
    });

    describe('Protected Routes', () => {
        it('GET /sales sem token → 401', () => {
            return request(app.getHttpServer())
                .get('/sales')
                .expect(401);
        });

        it('GET /notes sem token → 401', () => {
            return request(app.getHttpServer())
                .get('/notes')
                .expect(401);
        });

        it('GET /sales com token válido → 200', async () => {
            if (!authToken) return;

            return request(app.getHttpServer())
                .get('/sales')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
        });

        it('POST /sales sem certificado → 400', async () => {
            if (!authToken) return;

            return request(app.getHttpServer())
                .post('/sales')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    externalId: 'e2e-test-001',
                    tomakerName: 'Empresa Teste',
                    tomakerDocument: '12345678901234',
                    tomakerEmail: 'test@test.com',
                    serviceDescription: 'Serviço de teste E2E',
                    amount: 100.0,
                })
                .expect(400);
        });
    });
});
