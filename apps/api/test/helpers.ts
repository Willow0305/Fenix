import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '../src/generated/prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { hashPassword } from '../src/common/crypto/password-hasher';
import { totpCode, totpStep } from '../src/common/crypto/totp';
import { configureApplication } from '../src/configure-application';
import { syncAccessCatalog } from '../src/modules/access/application/roles.service';
import { syncFinanceCatalog } from '../src/modules/finance/application/finance-setup.service';
import { createPrismaClient } from '../src/common/prisma/prisma.service';

export const PASSWORD = 'senha-de-teste-2026';

export interface TestContext {
  readonly app: INestApplication;
  readonly prisma: PrismaClient;
  readonly outboxDir: string;
  readonly whatsappOutboxDir: string;
  readonly http: () => ReturnType<typeof request>;
}

/** Sobe a aplicação real contra o PostgreSQL definido em DATABASE_URL. */
export async function createTestContext(): Promise<TestContext> {
  const outboxDir = mkdtempSync(join(tmpdir(), 'fenix-outbox-'));
  const whatsappOutboxDir = mkdtempSync(join(tmpdir(), 'fenix-whatsapp-'));

  process.env['NODE_ENV'] = 'test';
  process.env['MAIL_OUTBOX_DIR'] = outboxDir;
  process.env['WHATSAPP_OUTBOX_DIR'] = whatsappOutboxDir;
  process.env['STORAGE_LOCAL_DIR'] = mkdtempSync(join(tmpdir(), 'fenix-storage-'));
  process.env['WEB_ORIGIN'] = 'http://localhost:3000';
  process.env['THROTTLE_DISABLED'] = 'true';

  const prisma = createPrismaClient();

  await prisma.$transaction(async (tx) => {
    await syncAccessCatalog(tx);
    await syncFinanceCatalog(tx);
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();

  configureApplication(app);
  await app.init();

  return {
    app,
    prisma,
    outboxDir,
    whatsappOutboxDir,
    http: () => request(app.getHttpServer())
  };
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

/** Segredos TOTP das contas de teste, para responder ao desafio de segunda etapa. */
const mfaSecrets = new Map<string, string>();

export function currentTotp(secret: string): string {
  return totpCode(secret, totpStep(new Date()));
}

/** Ativa a segunda etapa pela API, como faria a pessoa no painel (DT-037). */
export async function enrollMfa(
  ctx: TestContext,
  email: string,
  token: string,
  password = PASSWORD
): Promise<{ secret: string; recoveryCodes: string[] }> {
  const setup = await ctx
    .http()
    .post('/api/v1/me/mfa/setup')
    .set('Authorization', `Bearer ${token}`)
    .send({ password })
    .expect(200);
  const secret = (setup.body as { secret: string }).secret;
  const enabled = await ctx
    .http()
    .post('/api/v1/me/mfa/enable')
    .set('Authorization', `Bearer ${token}`)
    .send({ code: currentTotp(secret) })
    .expect(200);

  mfaSecrets.set(email, secret);

  return { secret, recoveryCodes: (enabled.body as { recoveryCodes: string[] }).recoveryCodes };
}

/**
 * Login completo. Perfis privilegiados passam pela segunda etapa: na primeira vez ativam o
 * autenticador; nas seguintes respondem ao desafio com um código válido.
 */
export async function login(ctx: TestContext, email: string, password = PASSWORD): Promise<string> {
  const response = await ctx
    .http()
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  const body = response.body as {
    accessToken?: string;
    mfaRequired?: boolean;
    challengeToken?: string;
  };

  if (body.mfaRequired === true && body.challengeToken !== undefined) {
    const secret = mfaSecrets.get(email);

    if (secret === undefined) {
      throw new Error('Conta de teste com MFA sem segredo conhecido.');
    }

    // Logins repetidos da mesma conta dentro de 30 s usariam o mesmo código, que a proteção
    // contra reutilização recusa; nos testes de outros módulos isso não está em avaliação.
    await ctx.prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { mfaLastUsedStep: null }
    });
    const verified = await ctx
      .http()
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: body.challengeToken, code: currentTotp(secret) })
      .expect(200);

    return (verified.body as { accessToken: string }).accessToken;
  }

  const token = body.accessToken ?? '';
  const me = await ctx.http().get('/api/v1/me').set('Authorization', `Bearer ${token}`).expect(200);

  if ((me.body as { mfa: { required: boolean } }).mfa.required) {
    await enrollMfa(ctx, email, token, password);
  }

  return token;
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

function withCheckDigits(base: number[], firstWeights: number[]): string {
  const digits = [...base];

  for (const weights of [firstWeights, [firstWeights[0]! + 1, ...firstWeights]]) {
    const sum = weights.reduce((total, weight, index) => total + digits[index]! * weight, 0);
    const rest = sum % 11;

    digits.push(rest < 2 ? 0 : 11 - rest);
  }

  return digits.join('');
}

/** CPF válido e aleatório (só dígitos), para testes que exigem documento único. */
export function randomCpf(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));

  base[0] = 1 + (base[0]! % 9);

  return withCheckDigits(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
}

/** CNPJ válido e aleatório (só dígitos). */
export function randomCnpj(): string {
  const base = [...Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)), 0, 0, 0, 1];

  base[0] = 1 + (base[0]! % 9);

  return withCheckDigits(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
}
