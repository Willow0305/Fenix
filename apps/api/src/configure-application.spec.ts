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

  it('exposes the OpenAPI document outside production', async () => {
    process.env['NODE_ENV'] = 'test';
    const app = await createApplication();

    try {
      await request(app.getHttpServer()).get('/docs/openapi.json').expect(200);
    } finally {
      await app.close();
    }
  });

  it('does not expose Swagger in production', async () => {
    process.env['NODE_ENV'] = 'production';
    const app = await createApplication();

    try {
      await request(app.getHttpServer()).get('/docs').expect(404);
      await request(app.getHttpServer()).get('/docs/openapi.json').expect(404);
    } finally {
      await app.close();
    }
  });
});
