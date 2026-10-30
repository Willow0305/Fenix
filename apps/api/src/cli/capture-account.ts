import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { hashPassword } from '../common/crypto/password-hasher';
import { PrismaService } from '../common/prisma/prisma.service';
import { SYSTEM_ROLES } from '../modules/access/domain/permission-catalog';
import { MfaService } from '../modules/auth/application/mfa.service';
import { normalizeEmail, validatePassword } from '../modules/auth/domain/auth-rules';
import { assertLocalOnly } from './capture-guard';

export const CAPTURE_EMAIL = 'capturas@fenix.example';
export const CAPTURE_FILE = path.resolve(process.cwd(), 'var', 'capturas-conta.json');

/**
 * Conta de capturas do painel (DT-081, D6): administrador local usado só pelo script de
 * capturas de tela, com a segunda etapa ativada pelo próprio script. Cada execução troca a
 * senha e remove a segunda etapa anterior; a senha nova fica em `var/` (fora do git).
 *
 * Uso: npm run capturas:conta
 */
async function main(): Promise<void> {
  assertLocalOnly(process.env);

  const password = `Cap-${randomBytes(18).toString('base64url')}-9a`;
  const problems = validatePassword(password, { email: CAPTURE_EMAIL, name: 'Capturas' });

  if (problems.length > 0) {
    throw new Error('Senha gerada fora da política; rode de novo.');
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const prisma = app.get(PrismaService);
    const role = await prisma.role.findUniqueOrThrow({ where: { code: SYSTEM_ROLES.admin } });
    const user = await prisma.user.upsert({
      where: { email: normalizeEmail(CAPTURE_EMAIL) },
      create: {
        name: 'Capturas de tela',
        email: normalizeEmail(CAPTURE_EMAIL),
        passwordHash: await hashPassword(password),
        status: 'ACTIVE'
      },
      update: { passwordHash: await hashPassword(password), status: 'ACTIVE', deletedAt: null }
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {}
    });
    // Segunda etapa antiga (de outra execução) não serve: o segredo dela não foi guardado.
    await app.get(MfaService).resetFor(null, user.id, 'Conta de capturas recriada', null);
    await prisma.auditLog.create({
      data: { action: 'user.capture_account', entityType: 'User', entityId: user.id }
    });

    mkdirSync(path.dirname(CAPTURE_FILE), { recursive: true });
    writeFileSync(CAPTURE_FILE, JSON.stringify({ email: CAPTURE_EMAIL, password }, null, 2), {
      mode: 0o600
    });
    console.log(`Conta de capturas pronta. Credenciais em ${CAPTURE_FILE} (fora do git).`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha ao criar a conta de capturas.');
  process.exitCode = 1;
});
