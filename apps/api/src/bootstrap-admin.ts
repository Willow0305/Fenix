import { HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NestFactory } from '@nestjs/core';

import { AccessControlModule } from './access-control/access-control.module';
import { InitialAdminService } from './access-control/initial-admin.service';
import { AppModule } from './app.module';

const logger = new Logger('InitialAdminBootstrap');

async function bootstrapInitialAdmin(): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn']
  });

  try {
    application.select(AccessControlModule);
    const service = application.get(InitialAdminService);
    const name = process.env['BOOTSTRAP_ADMIN_NAME'];
    const email = process.env['BOOTSTRAP_ADMIN_EMAIL'];
    const password = process.env['BOOTSTRAP_ADMIN_PASSWORD'];

    if (!name || !email || !password) {
      throw new Error(
        'Defina BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD.'
      );
    }

    await service.create({ name, email, password });
    logger.log('Administrador inicial criado e auditado com sucesso.');
  } finally {
    delete process.env['BOOTSTRAP_ADMIN_PASSWORD'];
    await application.close();
  }
}

bootstrapInitialAdmin().catch((error: unknown) => {
  let reason: string;
  let stack: string | undefined;

  if (error instanceof HttpException) {
    const response = error.getResponse();

    reason = typeof response === 'string' ? response : JSON.stringify(response, null, 2);

    stack = error.stack;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    reason = `Falha de persistência ${error.code}: ${error.message}`;
    stack = error.stack;
  } else if (error instanceof Error) {
    reason = error.message;
    stack = error.stack;
  } else {
    reason = JSON.stringify(error, null, 2);
  }

  logger.error(`Não foi possível criar o administrador inicial: ${reason}`, stack);

  process.exitCode = 1;
});
