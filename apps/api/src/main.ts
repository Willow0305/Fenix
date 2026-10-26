import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { configureApplication } from './configure-application';

const DEFAULT_API_PORT = 3333;
const bootstrapLogger = new Logger('Bootstrap');

function resolveApiPort(rawPort: string | undefined): number {
  if (rawPort === undefined) {
    return DEFAULT_API_PORT;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('API_PORT deve ser um inteiro entre 1 e 65535.');
  }

  return port;
}

async function bootstrap(): Promise<void> {
  // Adaptador explícito (DT-055): a busca automática parte do `@nestjs/core`, na raiz do
  // `node_modules`, e não acha o `@nestjs/platform-express` instalado dentro da API.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter());

  configureApplication(app);
  app.enableShutdownHooks();

  // Somente loopback por padrão: o navegador chega à API pelo proxy do Next.js. Em
  // contêineres, defina API_HOST=0.0.0.0 explicitamente.
  await app.listen(resolveApiPort(process.env['API_PORT']), process.env['API_HOST'] ?? '127.0.0.1');
}

bootstrap().catch(() => {
  bootstrapLogger.error('Não foi possível iniciar a API.');
  process.exitCode = 1;
});
