import { HttpStatus, RequestMethod, ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';

import { ProblemDetailsFilter } from './common/http/problem-details.filter';

const SWAGGER_PATH = 'docs';

export function configureApplication(app: INestApplication): void {
  const trustProxyHops = Number(process.env['TRUST_PROXY_HOPS'] ?? 0);

  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) {
    throw new Error('TRUST_PROXY_HOPS deve ser um inteiro entre 0 e 10.');
  }

  app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  const configuredOrigins = process.env['CORS_ORIGINS'];
  const corsOrigins = (
    configuredOrigins ?? (process.env['NODE_ENV'] === 'production' ? '' : 'http://localhost:3000')
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.includes('*')) {
    throw new Error('CORS_ORIGINS não aceita origem curinga quando credenciais estão habilitadas.');
  }

  if (process.env['NODE_ENV'] === 'production' && corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS é obrigatório em produção.');
  }

  app.enableCors({
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: corsOrigins
  });
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }]
  });
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false
      },
      whitelist: true
    })
  );

  if (process.env['NODE_ENV'] === 'production') {
    return;
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Fênix Vôlei API')
    .setDescription(
      'Autenticação, administração e auditoria da Fase 1, módulo esportivo da Fase 2 e Caixa Fênix da Fase 3.'
    )
    .setVersion('0.1.0')
    .addCookieAuth('fenix_access')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${SWAGGER_PATH}/openapi.json`
  });
}
