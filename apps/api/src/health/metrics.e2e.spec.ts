import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExpressAdapter } from '@nestjs/platform-express';
import request from 'supertest';

import { AppModule } from '../app.module';
import { configureApplication } from '../configure-application';

describe('GET /api/v1/metrics', () => {
  let app: INestApplication;
  const original = process.env['METRICS_TOKEN'];

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = testingModule.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env['METRICS_TOKEN'];
    } else {
      process.env['METRICS_TOKEN'] = original;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('não existe sem METRICS_TOKEN configurado', async () => {
    delete process.env['METRICS_TOKEN'];

    await request(app.getHttpServer())
      .get('/api/v1/metrics')
      .set('Authorization', 'Bearer qualquer')
      .expect(404);
  });

  it('responde 404 sem token ou com token errado', async () => {
    process.env['METRICS_TOKEN'] = 'token-de-teste-com-tamanho';

    await request(app.getHttpServer()).get('/api/v1/metrics').expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/metrics')
      .set('Authorization', 'Bearer token-de-teste-com-tamanhx')
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/metrics')
      .set('Authorization', 'Bearer curto')
      .expect(404);
  });

  it('entrega as métricas no formato Prometheus com o token certo', async () => {
    process.env['METRICS_TOKEN'] = 'token-de-teste-com-tamanho';

    await request(app.getHttpServer()).get('/health').expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/v1/metrics')
      .set('Authorization', 'Bearer token-de-teste-com-tamanho')
      .expect(200);

    expect(response.headers['content-type']).toMatch(/^text\/plain;.*version=0\.0\.4/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.text).toContain(
      'fenix_http_requests_total{method="GET",route="/health",status="200"}'
    );
    expect(response.text).not.toContain('token-de-teste');
  });
});
