import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { hashPassword } from '../src/common/crypto/password-hasher';
import { configureApplication } from '../src/configure-application';
import { syncAccessCatalog } from '../src/modules/access/application/roles.service';

export const PASSWORD = 'senha-de-teste-2026';

export interface TestContext {
  readonly app: INestApplication;
  readonly prisma: PrismaClient;
  readonly outboxDir: string;
  readonly http: () => ReturnType<typeof request>;
}

/** Sobe a aplicação real contra o PostgreSQL definido em DATABASE_URL. */
export async function createTestContext(): Promise<TestContext> {
  const outboxDir = mkdtempSync(join(tmpdir(), 'fenix-outbox-'));

  process.env['NODE_ENV'] = 'test';
  process.env['MAIL_OUTBOX_DIR'] = outboxDir;
  process.env['STORAGE_LOCAL_DIR'] = mkdtempSync(join(tmpdir(), 'fenix-storage-'));
  process.env['WEB_ORIGIN'] = 'http://localhost:3000';
  process.env['THROTTLE_DISABLED'] = 'true';

  const prisma = new PrismaClient();

  await prisma.$transaction((tx) => syncAccessCatalog(tx));

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();

  configureApplication(app);
  await app.init();

  return { app, prisma, outboxDir, http: () => request(app.getHttpServer()) };
}

export function uniqueEmail(prefix = 'teste'): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@exemplo.test`;
}

/** Cria usuário ativo com os papéis indicados diretamente no banco. */
export async function createUser(
  prisma: PrismaClient,
  roles: string[],
  overrides: { name?: string; email?: string } = {}
): Promise<{ id: string; email: string }> {
  const email = overrides.email ?? uniqueEmail(roles[0] ?? 'user');
  const roleRows = await prisma.role.findMany({ where: { code: { in: roles } } });
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? 'Pessoa Teste',
      email,
      passwordHash: await hashPassword(PASSWORD),
      status: 'ACTIVE',
      userRoles: { create: roleRows.map((role) => ({ roleId: role.id })) }
    }
  });

  return { id: user.id, email };
}

export async function login(ctx: TestContext, email: string, password = PASSWORD): Promise<string> {
  const response = await ctx
    .http()
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  return (response.body as { accessToken: string }).accessToken;
}

export function refreshCookieFrom(response: { headers: Record<string, unknown> }): string {
  const header = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? (header as string[]) : [];
  const cookie = cookies.find((value) => value.startsWith('fenix_rt='));

  if (cookie === undefined) {
    throw new Error('Cookie de refresh ausente.');
  }

  return cookie.split(';')[0] ?? '';
}

/** Cria usuário com papéis e retorna o access token. */
export async function tokenFor(
  ctx: TestContext,
  roles: string[]
): Promise<{ token: string; id: string }> {
  const user = await createUser(ctx.prisma, roles);

  return { token: await login(ctx, user.email), id: user.id };
}

export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
