import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from './app.module';
import { configureApplication } from './configure-application';

async function createApplication(): Promise<INestApplication> {
  const testingModule = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();
  const app = testingModule.createNestApplication();

  configureApplication(app);
  await app.init();

  return app;
}

describe('configureApplication', () => {
  const originalNodeEnv = process.env['NODE_ENV'];

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env['NODE_ENV'];
      return;
    }

    process.env['NODE_ENV'] = originalNodeEnv;
  });

  it('expõe a documentação OpenAPI fora de produção', async () => {
    process.env['NODE_ENV'] = 'test';
    const app = await createApplication();

    try {
      await request(app.getHttpServer()).get('/docs/openapi.json').expect(200);
    } finally {
      await app.close();
    }
  });

  it('não expõe o Swagger em produção', async () => {
    const productionEnv = {
      NODE_ENV: 'production',
      AUTH_ACCESS_TOKEN_SECRET: 'production-test-secret-with-enough-length-0123',
      DATA_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
      WEB_ORIGIN: 'https://fenix.example',
      ALLOW_LOCAL_ADAPTERS_IN_PRODUCTION: 'true'
    };
    const previous = Object.fromEntries(
      Object.keys(productionEnv).map((key) => [key, process.env[key]])
    );

    Object.assign(process.env, productionEnv);

    try {
      const app = await createApplication();

      try {
        await request(app.getHttpServer()).get('/docs').expect(404);
        await request(app.getHttpServer()).get('/docs/openapi.json').expect(404);
      } finally {
        await app.close();
      }
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it('recusa iniciar em produção sem os segredos obrigatórios', async () => {
    process.env['NODE_ENV'] = 'production';
    const secret = process.env['AUTH_ACCESS_TOKEN_SECRET'];

    delete process.env['AUTH_ACCESS_TOKEN_SECRET'];

    try {
      await expect(createApplication()).rejects.toThrow('AUTH_ACCESS_TOKEN_SECRET');
    } finally {
      if (secret !== undefined) {
        process.env['AUTH_ACCESS_TOKEN_SECRET'] = secret;
      }
    }
  });

  it('responde rotas desconhecidas no formato de problema', async () => {
    process.env['NODE_ENV'] = 'test';
    const app = await createApplication();

    try {
      const response = await request(app.getHttpServer()).get('/api/v1/nao-existe').expect(404);

      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.body).toMatchObject({ status: 404, code: 'NOT_FOUND' });
      expect(response.body.requestId).toEqual(expect.any(String));
    } finally {
      await app.close();
    }
  });

  it('recusa rotas protegidas sem token', async () => {
    process.env['NODE_ENV'] = 'test';
    const app = await createApplication();

    try {
      await request(app.getHttpServer()).get('/api/v1/me').expect(401);
      await request(app.getHttpServer()).get('/api/v1/users').expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', 'Bearer invalido.token.aqui')
        .expect(401);
    } finally {
      await app.close();
    }
  });
});
