import { type INestApplication, RequestMethod } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppConfig } from './common/config/app-config';
import { ProblemDetailsFilter } from './common/http/problem-details.filter';
import { requestIdMiddleware } from './common/http/request-context';
import { createValidationPipe } from './common/http/validation';

const SWAGGER_PATH = 'docs';
export const API_PREFIX = 'api/v1';

export function configureApplication(app: INestApplication): void {
  const config = app.get(AppConfig).values;
  const express = app as NestExpressApplication;

  // Só proxies confiáveis informam o IP real (X-Forwarded-For): o Next.js na mesma máquina
  // (loopback) e, em contêineres, o Nginx da rede interna (`TRUST_PROXY`, DT-053).
  express.set('trust proxy', config.trustProxy);
  express.disable('x-powered-by');

  app.use(requestIdMiddleware);
  app.use(
    helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } })
  );
  app.use(cookieParser());
  app.enableCors({ origin: [config.webOrigin], credentials: true });
  app.setGlobalPrefix(API_PREFIX, { exclude: [{ path: 'health', method: RequestMethod.GET }] });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ProblemDetailsFilter());

  if (process.env['NODE_ENV'] === 'production') {
    return;
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Fênix Vôlei API')
    .setDescription('API REST do sistema Fênix Vôlei.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${SWAGGER_PATH}/openapi.json`
  });
}
