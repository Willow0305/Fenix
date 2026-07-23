import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../app.module';
import { configureApplication } from '../configure-application';

describe('GET /health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = testingModule.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds without exposing configuration', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toEqual({
      service: 'fenix-api',
      status: 'ok',
      timestamp: expect.any(String)
    });
    expect(response.body).not.toHaveProperty('environment');
    expect(response.body).not.toHaveProperty('database');
  });
});
