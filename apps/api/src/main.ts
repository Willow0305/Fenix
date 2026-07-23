import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

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
  const app = await NestFactory.create(AppModule);

  configureApplication(app);
  app.enableShutdownHooks();

  await app.listen(resolveApiPort(process.env['API_PORT']), '0.0.0.0');
}

bootstrap().catch(() => {
  bootstrapLogger.error('Não foi possível iniciar a API.');
  process.exitCode = 1;
});
