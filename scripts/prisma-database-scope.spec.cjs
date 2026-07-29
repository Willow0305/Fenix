const assert = require('node:assert/strict');
const { after, test } = require('node:test');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const expectedMigrations = [
  '20260727000100_fase_1_identidade_acesso',
  '20260727000200_fase_1_admin_auditoria',
  '20260727000300_fase_1_seguranca_privacidade',
  '20260727000400_fase_2_esportivo',
  '20260727000410_fase_2_guardian_relationship',
  '20260729000100_fase_3_caixa_fenix'
];

const requiredChecks = [
  'athlete_profiles_fictitious_only',
  'financial_accounts_currency_brl_check',
  'financial_charges_amount_positive_check',
  'financial_charges_currency_brl_check',
  'financial_payments_amount_positive_check',
  'financial_plan_versions_amount_positive_check',
  'financial_transactions_amount_positive_check',
  'financial_transactions_source_shape_check',
  'financial_transfers_accounts_different_check',
  'guardian_authorizations_subject_required',
  'tryout_registrations_fictitious_only',
  'user_sessions_expiration_valid',
  'users_email_normalized'
];

after(async () => {
  await prisma.$disconnect();
});

test('all deployed domain tables use UUID primary identities', async () => {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT tablename AS "name"
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `);
  const identifiers = await prisma.$queryRawUnsafe(`
    SELECT table_name AS "tableName", data_type AS "dataType"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'id'
      AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `);

  assert.equal(tables.length, 42);
  assert.equal(identifiers.length, tables.length);
  assert.ok(identifiers.every(({ dataType }) => dataType === 'uuid'));
});

test('financial money columns are exact NUMERIC(19,4), never floating point', async () => {
  const moneyColumns = await prisma.$queryRawUnsafe(`
    SELECT
      table_name AS "tableName",
      column_name AS "columnName",
      data_type AS "dataType",
      numeric_precision AS "precision",
      numeric_scale AS "scale"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'cash_closings',
        'cash_sessions',
        'financial_charges',
        'financial_obligations',
        'financial_payments',
        'financial_plan_versions',
        'financial_transactions',
        'financial_transfers',
        'payment_allocations',
        'payment_credits',
        'payment_surpluses'
      )
      AND data_type = 'numeric'
    ORDER BY table_name, column_name
  `);
  const floatingColumns = await prisma.$queryRawUnsafe(`
    SELECT table_name AS "tableName", column_name AS "columnName"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name LIKE 'financial_%'
      AND data_type IN ('double precision', 'real')
  `);

  assert.equal(moneyColumns.length, 18);
  assert.ok(
    moneyColumns.every(
      ({ dataType, precision, scale }) => dataType === 'numeric' && precision === 19 && scale === 4
    )
  );
  assert.deepEqual(floatingColumns, []);
});

test('critical security, fictitious-only and accounting checks are deployed', async () => {
  const checks = await prisma.$queryRawUnsafe(`
    SELECT database_constraint.conname AS "name"
    FROM pg_constraint AS database_constraint
    JOIN pg_class AS relation ON relation.oid = database_constraint.conrelid
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND database_constraint.contype = 'c'
    ORDER BY database_constraint.conname
  `);
  const names = new Set(checks.map(({ name }) => name));

  for (const requiredCheck of requiredChecks) {
    assert.ok(names.has(requiredCheck), `Missing database check ${requiredCheck}.`);
  }
});

test('foreign keys declare update and delete behavior explicitly', async () => {
  const foreignKeys = await prisma.$queryRawUnsafe(`
    SELECT
      table_constraint.constraint_name AS "name",
      reference.update_rule AS "updateRule",
      reference.delete_rule AS "deleteRule"
    FROM information_schema.table_constraints AS table_constraint
    JOIN information_schema.referential_constraints AS reference
      ON reference.constraint_schema = table_constraint.constraint_schema
      AND reference.constraint_name = table_constraint.constraint_name
    WHERE table_constraint.constraint_schema = 'public'
      AND table_constraint.constraint_type = 'FOREIGN KEY'
    ORDER BY table_constraint.constraint_name
  `);

  assert.ok(foreignKeys.length >= 60);
  assert.ok(foreignKeys.every(({ updateRule }) => updateRule === 'CASCADE'));
  assert.ok(
    foreignKeys.every(({ deleteRule }) => ['CASCADE', 'RESTRICT', 'SET NULL'].includes(deleteRule))
  );
});

test('append-only and approved-ledger protection triggers are active', async () => {
  const triggers = await prisma.$queryRawUnsafe(`
    SELECT event_object_table AS "tableName", trigger_name AS "name"
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name
  `);
  const names = new Set(triggers.map(({ name }) => name));

  for (const trigger of [
    'audit_logs_append_only',
    'cash_closings_immutable',
    'financial_plan_versions_immutable',
    'financial_reconciliations_immutable',
    'financial_transactions_protect_approved',
    'payment_allocations_immutable'
  ]) {
    assert.ok(names.has(trigger), `Missing protection trigger ${trigger}.`);
  }
});

test('the database records exactly the approved incremental migrations', async () => {
  const migrations = await prisma.$queryRawUnsafe(`
    SELECT
      migration_name AS "name",
      finished_at IS NOT NULL AS "finished",
      rolled_back_at IS NULL AS "notRolledBack"
    FROM "_prisma_migrations"
    ORDER BY started_at
  `);

  assert.deepEqual(
    migrations.map(({ name }) => name),
    expectedMigrations
  );
  assert.ok(migrations.every(({ finished, notRolledBack }) => finished && notRolledBack));
});
