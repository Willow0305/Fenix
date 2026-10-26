const { execSync } = require('node:child_process');
const { resolve } = require('node:path');

const { Client } = require('pg');

const { testDatabaseUrl } = require('./test-database.cjs');

/** Recria o banco de testes e aplica as migrações antes da suíte de integração. */
module.exports = async function globalSetup() {
  const { url, name } = testDatabaseUrl();
  const maintenance = new URL(url);

  maintenance.pathname = '/postgres';

  maintenance.search = '';

  const admin = new Client({ connectionString: maintenance.toString() });

  await admin.connect();

  try {
    // `name` foi validado por testDatabaseUrl (somente letras, números e "_").
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '../../..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit'
  });
};
