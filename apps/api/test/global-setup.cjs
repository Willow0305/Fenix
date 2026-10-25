const { execSync } = require('node:child_process');
const { resolve } = require('node:path');

const { PrismaClient } = require('@prisma/client');

const { testDatabaseUrl } = require('./test-database.cjs');

/** Recria o banco de testes e aplica as migrações antes da suíte de integração. */
module.exports = async function globalSetup() {
  const { url, name } = testDatabaseUrl();
  const maintenance = new URL(url);

  maintenance.pathname = '/postgres';

  const admin = new PrismaClient({ datasources: { db: { url: maintenance.toString() } } });

  try {
    // `name` foi validado por testDatabaseUrl (somente letras, números e "_").
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.$disconnect();
  }

  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '../../..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit'
  });
};
