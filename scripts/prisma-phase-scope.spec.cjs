const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..');
const executableSchemaPath = path.join(repositoryRoot, 'prisma', 'schema.prisma');
const conceptualSchemaPath = path.join(
  repositoryRoot,
  'docs',
  'referencias',
  'schema-conceitual.prisma'
);
const migrationName = '20260727000100_fase_1_identidade_acesso';
const migrationPath = path.join(
  repositoryRoot,
  'prisma',
  'migrations',
  migrationName,
  'migration.sql'
);
const adminAuditMigrationName = '20260727000200_fase_1_admin_auditoria';
const adminAuditMigrationPath = path.join(
  repositoryRoot,
  'prisma',
  'migrations',
  adminAuditMigrationName,
  'migration.sql'
);
const securityPrivacyMigrationName = '20260727000300_fase_1_seguranca_privacidade';
const securityPrivacyMigrationPath = path.join(
  repositoryRoot,
  'prisma',
  'migrations',
  securityPrivacyMigrationName,
  'migration.sql'
);
const sportsMigrationName = '20260727000400_fase_2_esportivo';
const sportsMigrationPath = path.join(
  repositoryRoot,
  'prisma',
  'migrations',
  sportsMigrationName,
  'migration.sql'
);
const sportsGuardianRelationshipMigrationName = '20260727000410_fase_2_guardian_relationship';
const sportsGuardianRelationshipMigrationPath = path.join(
  repositoryRoot,
  'prisma',
  'migrations',
  sportsGuardianRelationshipMigrationName,
  'migration.sql'
);
const financeMigrationName = '20260729000100_fase_3_caixa_fenix';
const financeMigrationPath = path.join(
  repositoryRoot,
  'prisma',
  'migrations',
  financeMigrationName,
  'migration.sql'
);

const allowedModels = [
  'AthleteAffiliation',
  'AthleteGuardian',
  'AthleteProfile',
  'AuditLog',
  'CashClosing',
  'CashSession',
  'Category',
  'CostCenter',
  'DataSubjectRequest',
  'FinancialAccount',
  'FinancialCategory',
  'FinancialCharge',
  'FinancialObligation',
  'FinancialPayment',
  'FinancialPlan',
  'FinancialPlanVersion',
  'FinancialReconciliation',
  'FinancialTransaction',
  'FinancialTransfer',
  'Guardian',
  'GuardianAuthorization',
  'ImportBatch',
  'ImportRow',
  'MfaCredential',
  'MfaRecoveryCode',
  'PaymentAllocation',
  'PaymentCredit',
  'PaymentSurplus',
  'Permission',
  'PrivateAttachment',
  'RetentionRun',
  'Role',
  'RolePermission',
  'Team',
  'TeamCategory',
  'Tryout',
  'TryoutRegistration',
  'TryoutRegistrationHistory',
  'User',
  'UserRole',
  'UserSession',
  'UserToken'
];
const allowedEnums = [
  'AthleteProfileStatus',
  'CashSessionStatus',
  'DataSubjectRequestStatus',
  'DataSubjectRequestType',
  'FinancialAccountType',
  'FinancialCategoryType',
  'FinancialChargeStatus',
  'FinancialObligationStatus',
  'FinancialObligationType',
  'FinancialPaymentStatus',
  'FinancialPlanStatus',
  'FinancialSurplusDisposition',
  'FinancialTransactionStatus',
  'FinancialTransactionType',
  'FinancialTransferStatus',
  'GuardianAuthorizationStatus',
  'ImportBatchStatus',
  'ImportRowStatus',
  'PaymentCreditStatus',
  'PrivateAttachmentStatus',
  'RetentionRunStatus',
  'SportCategoryKind',
  'SportsImportKind',
  'TryoutRegistrationStatus',
  'TryoutStatus',
  'UserStatus',
  'UserTokenType'
];
const allowedTables = [
  'permissions',
  'role_permissions',
  'roles',
  'user_roles',
  'user_sessions',
  'user_tokens',
  'users'
];
const requiredCheckConstraints = [
  'permissions_code_not_blank',
  'permissions_deleted_at_valid',
  'permissions_name_not_blank',
  'roles_code_not_blank',
  'roles_deleted_at_valid',
  'roles_name_not_blank',
  'user_roles_expiration_valid',
  'user_sessions_activity_valid',
  'user_sessions_expiration_valid',
  'user_sessions_ip_address_hash_not_blank',
  'user_sessions_refresh_token_hash_not_blank',
  'user_sessions_revocation_valid',
  'user_sessions_rotation_not_self',
  'user_sessions_user_agent_hash_not_blank',
  'user_tokens_blocked_until_valid',
  'user_tokens_consumed_at_valid',
  'user_tokens_expiration_valid',
  'user_tokens_failed_attempts_valid',
  'user_tokens_token_hash_not_blank',
  'users_deleted_at_valid',
  'users_email_normalized',
  'users_name_not_blank',
  'users_password_hash_not_blank'
];

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function extractNames(source, declaration) {
  return [...source.matchAll(new RegExp(`^${declaration}\\s+([A-Za-z][A-Za-z0-9_]*)\\s*\\{`, 'gm'))]
    .map((match) => match[1])
    .sort();
}

function extractEnumValues(source, enumName) {
  const match = source.match(new RegExp(`enum\\s+${enumName}\\s*\\{([\\s\\S]*?)\\}`, 'm'));

  assert.ok(match, `Enum ${enumName} should exist.`);

  return match[1]
    .split(/\r?\n/u)
    .map((line) => line.replace(/\/\/.*$/u, '').trim())
    .filter(Boolean);
}

function extractModelBlocks(source) {
  return [...source.matchAll(/^model\s+([A-Za-z][A-Za-z0-9_]*)\s*\{([\s\S]*?)^\}/gm)].map(
    ([, name, body]) => ({
      body,
      name
    })
  );
}

test('the executable Prisma schema contains only the authorized Phase 1, 2 and 3 slices', () => {
  const schema = readFile(executableSchemaPath);

  assert.deepEqual(extractNames(schema, 'model'), allowedModels);
  assert.deepEqual(extractNames(schema, 'enum'), allowedEnums);
  assert.deepEqual(extractEnumValues(schema, 'UserStatus'), [
    'PENDING',
    'ACTIVE',
    'INACTIVE',
    'BLOCKED'
  ]);
  assert.deepEqual(extractEnumValues(schema, 'UserTokenType'), [
    'PASSWORD_RESET',
    'EMAIL_VERIFICATION',
    'MFA_LOGIN_CHALLENGE'
  ]);
  assert.match(schema, /refreshTokenHash\s+String\s+@unique.*@db\.Text/u);
  assert.match(schema, /tokenHash\s+String\s+@unique.*@db\.Text/u);
  assert.match(schema, /csrfTokenHash\s+String.*@db\.Text/u);
  assert.doesNotMatch(
    schema,
    /(?:refreshTokenHash|tokenHash|userAgentHash|ipAddressHash).*@db\.Char/u
  );
  assert.doesNotMatch(schema, /(?:medical|health|diagnosis|laudo|prontuario)/iu);

  for (const { body, name } of extractModelBlocks(schema)) {
    assert.match(
      body,
      /^\s*id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid\s*$/m,
      `${name} must use a UUID primary key.`
    );
  }
});

test('the complete conceptual schema remains preserved outside the migration path', () => {
  const conceptualSchema = readFile(conceptualSchemaPath);

  assert.match(conceptualSchema, /REFERÊNCIA CONCEITUAL — NÃO EXECUTAR COM PRISMA MIGRATE/u);
  assert.equal(extractNames(conceptualSchema, 'model').length, 66);
  assert.equal(extractNames(conceptualSchema, 'enum').length, 53);
});

test('the first migration creates only Phase 1 identity tables and enums', () => {
  const migration = readFile(migrationPath);
  const createdTables = [...migration.matchAll(/CREATE TABLE "([^"]+)"/gu)]
    .map((match) => match[1])
    .sort();
  const createdEnums = [...migration.matchAll(/CREATE TYPE "([^"]+)" AS ENUM/gu)]
    .map((match) => match[1])
    .sort();

  assert.deepEqual(createdTables, allowedTables);
  assert.deepEqual(createdEnums, ['UserStatus', 'UserTokenType']);

  for (const constraint of requiredCheckConstraints) {
    assert.match(migration, new RegExp(`CONSTRAINT "${constraint}" CHECK`, 'u'));
  }

  const foreignKeys = migration
    .split(/\r?\n/u)
    .filter((line) => line.includes('ADD CONSTRAINT') && line.includes('_fkey'));

  assert.ok(foreignKeys.length > 0);
  for (const foreignKey of foreignKeys) {
    assert.match(foreignKey, / ON DELETE (CASCADE|RESTRICT|SET NULL) ON UPDATE CASCADE;$/u);
  }

  assert.match(migration, /user_sessions_user_id_fkey".*ON DELETE RESTRICT ON UPDATE CASCADE;/u);
  assert.match(migration, /user_tokens_user_id_fkey".*ON DELETE RESTRICT ON UPDATE CASCADE;/u);
});

test('the admin and audit migration promotes only AuditLog and auth hardening fields', () => {
  const migration = readFile(adminAuditMigrationPath);
  const createdTables = [...migration.matchAll(/CREATE TABLE "([^"]+)"/gu)]
    .map((match) => match[1])
    .sort();
  const createdEnums = [...migration.matchAll(/CREATE TYPE "([^"]+)" AS ENUM/gu)]
    .map((match) => match[1])
    .sort();

  assert.deepEqual(createdTables, ['audit_logs']);
  assert.deepEqual(createdEnums, []);
  assert.match(migration, /ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0/u);
  assert.match(migration, /ADD COLUMN "blocked_until" TIMESTAMPTZ\(6\)/u);
  assert.match(migration, /ADD COLUMN "csrf_token_hash" TEXT/u);
  assert.match(migration, /audit_logs_append_only/u);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON "audit_logs"/u);
  assert.doesNotMatch(
    migration,
    /CREATE TABLE "(?:athletes|monthly_fees|financial_transactions|products|forum_posts)"/u
  );
});

test('the security migration promotes only Phase 1 security and privacy structures', () => {
  const migration = readFile(securityPrivacyMigrationPath);
  const createdTables = [...migration.matchAll(/CREATE TABLE "([^"]+)"/gu)]
    .map((match) => match[1])
    .sort();

  assert.deepEqual(createdTables, [
    'data_subject_requests',
    'mfa_credentials',
    'mfa_recovery_codes',
    'private_attachments',
    'retention_runs'
  ]);
  assert.match(migration, /ADD VALUE 'EMAIL_VERIFICATION'/u);
  assert.match(migration, /ADD VALUE 'MFA_LOGIN_CHALLENGE'/u);
  assert.match(migration, /ADD COLUMN "absolute_expires_at"/u);
  assert.match(migration, /ADD COLUMN "email_verified_at"/u);
  assert.doesNotMatch(
    migration,
    /CREATE TABLE "(?:athlete_profiles|monthly_fees|financial_transactions|products)"/u
  );
});

test('the sports migration is additive, fictitious-only and free of health data', () => {
  const migration = readFile(sportsMigrationPath);
  const createdTables = [...migration.matchAll(/CREATE TABLE "([^"]+)"/gu)]
    .map((match) => match[1])
    .sort();

  assert.deepEqual(createdTables, [
    'athlete_affiliations',
    'athlete_guardians',
    'athlete_profiles',
    'guardian_authorizations',
    'guardians',
    'import_batches',
    'import_rows',
    'sport_categories',
    'team_categories',
    'teams',
    'tryout_registration_history',
    'tryout_registrations',
    'tryouts'
  ]);
  assert.match(migration, /athlete_profiles_fictitious_only/u);
  assert.match(migration, /tryout_registrations_fictitious_only/u);
  assert.match(migration, /guardian_authorizations_subject_required/u);
  assert.match(migration, /tryout_registrations_fingerprint_valid/u);
  assert.doesNotMatch(migration, /(?:medical|health|diagnosis|laudo|prontuario)/iu);
  assert.doesNotMatch(
    migration,
    /(?:DROP TABLE|DROP COLUMN|ALTER COLUMN|RENAME (?:TABLE|COLUMN))/iu
  );
});

test('the guardian relationship follow-up preserves the declared minor link', () => {
  const migration = readFile(sportsGuardianRelationshipMigrationPath);

  assert.match(migration, /ADD COLUMN "relationship" VARCHAR\(80\) NOT NULL/u);
  assert.match(migration, /guardian_authorizations_relationship_not_blank/u);
  assert.doesNotMatch(migration, /(?:DROP|RENAME)/iu);
});

test('the Phase 3 migration adds the protected Caixa Fênix ledger without destructive SQL', () => {
  const migration = readFile(financeMigrationPath);
  const createdTables = [...migration.matchAll(/CREATE TABLE "([^"]+)"/gu)]
    .map((match) => match[1])
    .sort();

  assert.deepEqual(createdTables, [
    'cash_closings',
    'cash_sessions',
    'cost_centers',
    'financial_accounts',
    'financial_categories',
    'financial_charges',
    'financial_obligations',
    'financial_payments',
    'financial_plan_versions',
    'financial_plans',
    'financial_reconciliations',
    'financial_transactions',
    'financial_transfers',
    'payment_allocations',
    'payment_credits',
    'payment_surpluses'
  ]);
  assert.match(migration, /DECIMAL\(19,4\)/u);
  assert.match(migration, /financial_accounts_currency_brl_check/u);
  assert.match(migration, /cash_sessions_one_open_per_account_key/u);
  assert.match(migration, /financial_plan_versions_immutable/u);
  assert.match(migration, /financial_transactions_protect_approved/u);
  assert.doesNotMatch(migration, /(?:FLOAT|DOUBLE PRECISION)/iu);
  assert.doesNotMatch(migration, /(?:medical|health|diagnosis|laudo|prontuario)/iu);
  assert.doesNotMatch(
    migration,
    /(?:DROP TABLE|DROP COLUMN|ALTER COLUMN|RENAME (?:TABLE|COLUMN))/iu
  );
});

test('the migration history contains the incremental Phase 1, 2 and 3 slices', () => {
  const migrationDirectory = path.dirname(migrationPath);
  const adminAuditMigrationDirectory = path.dirname(adminAuditMigrationPath);
  const securityPrivacyMigrationDirectory = path.dirname(securityPrivacyMigrationPath);
  const sportsMigrationDirectory = path.dirname(sportsMigrationPath);
  const sportsGuardianRelationshipMigrationDirectory = path.dirname(
    sportsGuardianRelationshipMigrationPath
  );
  const financeMigrationDirectory = path.dirname(financeMigrationPath);

  assert.equal(path.basename(migrationDirectory), migrationName);
  assert.equal(path.basename(adminAuditMigrationDirectory), adminAuditMigrationName);
  assert.equal(path.basename(securityPrivacyMigrationDirectory), securityPrivacyMigrationName);
  assert.equal(path.basename(sportsMigrationDirectory), sportsMigrationName);
  assert.equal(
    path.basename(sportsGuardianRelationshipMigrationDirectory),
    sportsGuardianRelationshipMigrationName
  );
  assert.equal(path.basename(financeMigrationDirectory), financeMigrationName);
  assert.equal(
    readFile(path.join(repositoryRoot, 'prisma', 'migrations', 'migration_lock.toml')).trim(),
    [
      '# Please do not edit this file manually',
      '# It should be added in your version-control system (e.g. Git)',
      'provider = "postgresql"'
    ].join('\n')
  );
});
