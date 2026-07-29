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
  const originalAppEnv = process.env['APP_ENV'];
  const originalAccessSecret = process.env['AUTH_ACCESS_TOKEN_SECRET'];
  const originalCookieSecure = process.env['AUTH_COOKIE_SECURE'];
  const originalContextPepper = process.env['AUTH_CONTEXT_HASH_PEPPER'];
  const originalCorsOrigins = process.env['CORS_ORIGINS'];
  const originalTokenPepper = process.env['AUTH_TOKEN_PEPPER'];
  const originalMfaEncryptionKey = process.env['AUTH_MFA_ENCRYPTION_KEY'];

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = originalNodeEnv;
    }

    if (originalAppEnv === undefined) {
      delete process.env['APP_ENV'];
    } else {
      process.env['APP_ENV'] = originalAppEnv;
    }

    if (originalAccessSecret === undefined) {
      delete process.env['AUTH_ACCESS_TOKEN_SECRET'];
    } else {
      process.env['AUTH_ACCESS_TOKEN_SECRET'] = originalAccessSecret;
    }

    if (originalContextPepper === undefined) {
      delete process.env['AUTH_CONTEXT_HASH_PEPPER'];
    } else {
      process.env['AUTH_CONTEXT_HASH_PEPPER'] = originalContextPepper;
    }

    if (originalCookieSecure === undefined) {
      delete process.env['AUTH_COOKIE_SECURE'];
    } else {
      process.env['AUTH_COOKIE_SECURE'] = originalCookieSecure;
    }

    if (originalCorsOrigins === undefined) {
      delete process.env['CORS_ORIGINS'];
    } else {
      process.env['CORS_ORIGINS'] = originalCorsOrigins;
    }

    if (originalTokenPepper === undefined) {
      delete process.env['AUTH_TOKEN_PEPPER'];
    } else {
      process.env['AUTH_TOKEN_PEPPER'] = originalTokenPepper;
    }

    if (originalMfaEncryptionKey === undefined) {
      delete process.env['AUTH_MFA_ENCRYPTION_KEY'];
    } else {
      process.env['AUTH_MFA_ENCRYPTION_KEY'] = originalMfaEncryptionKey;
    }
  });

  it('exposes the OpenAPI document outside production', async () => {
    process.env['NODE_ENV'] = 'test';
    const app = await createApplication();

    try {
      const response = await request(app.getHttpServer()).get('/docs/openapi.json').expect(200);
      const healthSchema = response.body.components?.schemas?.HealthResponseDto;

      expect(healthSchema?.properties?.service).toEqual(
        expect.objectContaining({
          example: 'fenix-api',
          type: 'string'
        })
      );
      expect(healthSchema?.properties?.timestamp).toEqual(
        expect.objectContaining({
          format: 'date-time',
          type: 'string'
        })
      );
    } finally {
      await app.close();
    }
  });

  it('does not expose Swagger in production', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['APP_ENV'] = 'test';
    process.env['AUTH_ACCESS_TOKEN_SECRET'] = 'production-test-access-secret-000000000000000';
    process.env['AUTH_COOKIE_SECURE'] = 'true';
    process.env['AUTH_CONTEXT_HASH_PEPPER'] = 'production-test-context-pepper-000000000000000';
    process.env['CORS_ORIGINS'] = 'https://fenix.example';
    process.env['AUTH_TOKEN_PEPPER'] = 'production-test-token-pepper-000000000000000';
    process.env['AUTH_MFA_ENCRYPTION_KEY'] = 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=';
    const app = await createApplication();

    try {
      await request(app.getHttpServer()).get('/docs').expect(404);
      await request(app.getHttpServer()).get('/docs/openapi.json').expect(404);
    } finally {
      await app.close();
    }
  });
});
