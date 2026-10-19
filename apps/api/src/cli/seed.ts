import { PrismaClient } from '@prisma/client';

import { hashPassword } from '../common/crypto/password-hasher';
import { syncAccessCatalog } from '../modules/access/application/roles.service';
import { syncFinanceCatalog } from '../modules/finance/application/finance-setup.service';
import { SYSTEM_ROLES } from '../modules/access/domain/permission-catalog';
import { normalizeEmail, validatePassword } from '../modules/auth/domain/auth-rules';
import {
  defaultSettingsData,
  SETTINGS_KEY
} from '../modules/settings/application/settings.service';

/**
 * Seed idempotente: sincroniza permissões/papéis, cria a configuração do time e, se não
 * houver administrador, cria o primeiro a partir de SEED_ADMIN_*. Não cria dados fictícios
 * de negócio; use `npm run db:demo` para isso.
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    await prisma.$transaction(async (tx) => {
      await syncAccessCatalog(tx);
      await syncFinanceCatalog(tx);
      await tx.teamSettings.upsert({
        where: { singletonKey: SETTINGS_KEY },
        create: defaultSettingsData(),
        update: {}
      });
    });
    console.log('Catálogo de permissões, plano financeiro e configurações sincronizados.');

    const admins = await prisma.user.count({
      where: { deletedAt: null, userRoles: { some: { role: { code: SYSTEM_ROLES.admin } } } }
    });

    if (admins > 0) {
      console.log('Administrador já existente; nenhuma conta criada.');
      return;
    }

    const email = process.env['SEED_ADMIN_EMAIL'];
    const password = process.env['SEED_ADMIN_PASSWORD'];
    const name = process.env['SEED_ADMIN_NAME'] ?? 'Administrador';

    if (!email || !password) {
      console.log('SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD ausentes; administrador não criado.');
      return;
    }

    const problems = validatePassword(password, { email, name });

    if (problems.length > 0) {
      throw new Error(
        `SEED_ADMIN_PASSWORD não atende à política: ${problems.map((p) => p.message).join(' ')}`
      );
    }

    const role = await prisma.role.findUniqueOrThrow({ where: { code: SYSTEM_ROLES.admin } });
    const user = await prisma.user.upsert({
      where: { email: normalizeEmail(email) },
      create: {
        name,
        email: normalizeEmail(email),
        passwordHash: await hashPassword(password),
        status: 'ACTIVE'
      },
      update: { status: 'ACTIVE' }
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {}
    });
    await prisma.auditLog.create({
      data: { action: 'user.seeded_admin', entityType: 'User', entityId: user.id }
    });
    console.log('Administrador inicial criado.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha no seed.');
  process.exitCode = 1;
});
