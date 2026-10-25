import { Prisma, PrismaClient } from '@prisma/client';

import { SETTINGS_KEY } from '../modules/settings/application/settings.service';

/**
 * Limpa do banco de desenvolvimento o que os testes de integração gravaram antes de terem
 * banco próprio (PEN-059, DT-038). Por padrão só simula; grava com `--apply`.
 *
 * - Identifica dado de teste pela auditoria: entidade cuja criação foi feita por conta
 *   `@exemplo.test`.
 * - Aplica exclusão lógica (`deletedAt`) apenas em cadastros exibidos nas telas. Registros
 *   financeiros (pagamentos, lançamentos, contas, pedidos, repasses) nunca são tocados.
 * - Desfaz nas configurações do time o que contas de teste gravaram: logos voltam à última
 *   enviada por pessoa real; telefone, redes sociais e PIX gravados por teste são limpos.
 * - Toda alteração gera registro de auditoria `maintenance.test_data.*`.
 */

const TEST_EMAIL = '%@exemplo.test';

/** Entidade de auditoria → tabela com `deleted_at`. Somente cadastros não financeiros. */
const SOFT_DELETABLE: Record<string, string> = {
  Product: 'products',
  ProductVariant: 'product_variants',
  ProductCategory: 'product_categories',
  SalesCampaign: 'sales_campaigns',
  Partner: 'partners',
  PartnerService: 'partner_services',
  PartnerProfessional: 'partner_professionals',
  Team: 'teams',
  Tryout: 'tryouts',
  TryoutRegistration: 'tryout_registrations',
  Athlete: 'athletes',
  MonthlyFeePlan: 'monthly_fee_plans',
  News: 'news',
  NewsCategory: 'news_categories',
  Event: 'events',
  ForumCategory: 'forum_categories',
  ForumTopic: 'forum_topics',
  ForumPost: 'forum_posts'
};

interface Counter {
  readonly label: string;
  readonly count: number;
}

async function testCreatedIds(prisma: PrismaClient, entityType: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ entity_id: string }[]>`
    SELECT DISTINCT a.entity_id::text AS entity_id
    FROM audit_logs a
    JOIN users u ON u.id = a.actor_user_id
    WHERE a.entity_type = ${entityType}
      AND a.entity_id IS NOT NULL
      AND u.email LIKE ${TEST_EMAIL}
      AND (a.action LIKE '%.created' OR a.action = 'user.registered')`;

  return rows.map((row) => row.entity_id);
}

async function softDeleteTestEntities(prisma: PrismaClient, apply: boolean): Promise<Counter[]> {
  const result: Counter[] = [];

  for (const [entityType, table] of Object.entries(SOFT_DELETABLE)) {
    const ids = await testCreatedIds(prisma, entityType);

    if (ids.length === 0) {
      continue;
    }

    const where = Prisma.sql`id = ANY(${ids}::uuid[]) AND deleted_at IS NULL`;
    const [row] = await prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT count(*)::bigint AS count FROM ${Prisma.raw(table)} WHERE ${where}`
    );
    const count = row?.count ?? 0n;

    if (apply && count > 0n) {
      await prisma.$transaction([
        prisma.$executeRaw(
          Prisma.sql`UPDATE ${Prisma.raw(table)} SET deleted_at = now() WHERE ${where}`
        ),
        prisma.auditLog.create({
          data: {
            action: 'maintenance.test_data.soft_deleted',
            entityType,
            reason:
              'Limpeza de dados gravados por testes de integração no banco de desenvolvimento.',
            afterData: { table, count: Number(count) }
          }
        })
      ]);
    }

    result.push({ label: `${entityType} (${table})`, count: Number(count) });
  }

  return result;
}

/** Devolve cada logo trocada por conta de teste à última enviada por pessoa real. */
async function restoreBrandAssets(prisma: PrismaClient, apply: boolean): Promise<Counter[]> {
  const result: Counter[] = [];
  const settings = await prisma.teamSettings.findUniqueOrThrow({
    where: { singletonKey: SETTINGS_KEY },
    select: { id: true, brandAssets: { select: { id: true, context: true, mediaFile: true } } }
  });

  for (const asset of settings.brandAssets) {
    const uploader = asset.mediaFile.uploadedById
      ? await prisma.user.findUnique({
          where: { id: asset.mediaFile.uploadedById },
          select: { email: true }
        })
      : null;

    if (!uploader?.email.endsWith('@exemplo.test')) {
      continue;
    }

    const [real] = await prisma.$queryRaw<{ media_id: string }[]>`
      SELECT a.after_data->>'mediaFileId' AS media_id
      FROM audit_logs a
      JOIN users u ON u.id = a.actor_user_id
      WHERE a.action = 'settings.brand_asset.updated'
        AND a.after_data->>'context' = ${asset.context}
        AND a.after_data->>'mediaFileId' IS NOT NULL
        AND u.email NOT LIKE ${TEST_EMAIL}
      ORDER BY a.occurred_at DESC
      LIMIT 1`;

    if (apply) {
      await prisma.$transaction(async (tx) => {
        if (real) {
          await tx.teamBrandAsset.update({
            where: { id: asset.id },
            data: { mediaFileId: real.media_id }
          });
        } else {
          await tx.teamBrandAsset.delete({ where: { id: asset.id } });
        }

        await tx.auditLog.create({
          data: {
            action: 'maintenance.test_data.brand_asset_restored',
            entityType: 'TeamSettings',
            entityId: settings.id,
            reason: 'Logo substituída por teste de integração.',
            beforeData: { context: asset.context, mediaFileId: asset.mediaFile.id },
            afterData: { context: asset.context, mediaFileId: real?.media_id ?? null }
          }
        });
      });
    }

    result.push({
      label: `logo ${asset.context} → ${real ? 'última enviada por pessoa real' : 'removida'}`,
      count: 1
    });
  }

  return result;
}

async function lastSettingsWriterIsTest(prisma: PrismaClient, action: string): Promise<boolean> {
  const [last] = await prisma.$queryRaw<{ email: string | null }[]>`
    SELECT u.email
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.actor_user_id
    WHERE a.action = ${action}
    ORDER BY a.occurred_at DESC
    LIMIT 1`;

  return last?.email?.endsWith('@exemplo.test') ?? false;
}

/** Limpa contato público e PIX quando a última gravação foi de conta de teste. */
async function clearTestSettings(prisma: PrismaClient, apply: boolean): Promise<Counter[]> {
  const result: Counter[] = [];
  const settings = await prisma.teamSettings.findUniqueOrThrow({
    where: { singletonKey: SETTINGS_KEY },
    select: { id: true, phone: true, socialLinks: true, pixKeyEncrypted: true }
  });
  const data: Prisma.TeamSettingsUpdateInput = {};

  if (await lastSettingsWriterIsTest(prisma, 'settings.public.updated')) {
    data.phone = null;
    data.socialLinks = Prisma.DbNull;
    result.push({ label: 'telefone e redes sociais gravados por teste', count: 1 });
  }

  if (
    settings.pixKeyEncrypted !== null &&
    (await lastSettingsWriterIsTest(prisma, 'settings.financial.updated'))
  ) {
    data.pixKeyEncrypted = null;
    result.push({ label: 'chave PIX gravada por teste', count: 1 });
  }

  if (apply && Object.keys(data).length > 0) {
    await prisma.$transaction([
      prisma.teamSettings.update({ where: { id: settings.id }, data }),
      prisma.auditLog.create({
        data: {
          action: 'maintenance.test_data.settings_cleared',
          entityType: 'TeamSettings',
          entityId: settings.id,
          reason: 'Valores gravados por teste de integração.',
          // A chave PIX nunca vai para a auditoria (docs/13).
          beforeData: { phone: settings.phone, socialLinks: settings.socialLinks ?? null },
          afterData: { cleared: Object.keys(data) }
        }
      })
    ]);
  }

  return result;
}

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('Este comando é exclusivo do ambiente de desenvolvimento.');
  }

  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();

  try {
    const counters = [
      ...(await restoreBrandAssets(prisma, apply)),
      ...(await clearTestSettings(prisma, apply)),
      ...(await softDeleteTestEntities(prisma, apply))
    ];

    console.log(
      apply ? 'Alterações aplicadas:' : 'Simulação (nada foi gravado). Use --apply para aplicar.'
    );

    for (const counter of counters) {
      console.log(`  ${String(counter.count).padStart(5)}  ${counter.label}`);
    }

    if (counters.length === 0) {
      console.log('  Nenhum dado de teste encontrado.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
