/**
 * Prepara o E2E: recria o banco `_e2e`, aplica as migrações, cria o administrador e os dados
 * de demonstração, e compila o site numa pasta própria. Recusa rodar em produção.
 */
const { execSync } = require('node:child_process');
const { readFileSync, rmSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const { Client } = require('pg');

const { ROOT, e2eDatabaseUrl, e2eEnv } = require('./env.cjs');

async function recreateDatabase() {
  const target = new URL(e2eDatabaseUrl());
  const name = target.pathname.slice(1);

  if (!/^[a-z0-9_]+_e2e$/i.test(name)) {
    throw new Error(`Banco do E2E precisa terminar em "_e2e" (recebido: ${name}).`);
  }

  const admin = new URL(target);

  admin.pathname = '/postgres';

  const client = new Client({ connectionString: admin.toString() });

  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${name}"`);
  await client.end();
}

function run(command, cwd = ROOT, extra = {}) {
  execSync(command, { cwd, env: { ...e2eEnv(), ...extra }, stdio: 'inherit' });
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('O E2E não roda em produção.');
  }

  // Segredo de segunda etapa da execução anterior não vale no banco novo.
  rmSync(path.join(ROOT, 'var', 'e2e-admin-mfa.json'), { force: true });
  await recreateDatabase();
  run('npx prisma migrate deploy');
  run('node apps/api/dist/cli/seed.js');
  run('node apps/api/dist/cli/demo.js');
  // Build limpo: o cache de dados do Next guardaria produtos do banco anterior (ids que não
  // existem mais no banco recriado) e o primeiro "Adicionar ao carrinho" falharia.
  rmSync(path.join(ROOT, 'apps', 'web', '.next-e2e'), { recursive: true, force: true });
  // O build do Next exige NODE_ENV=production (React de produção). Ele reescreve o
  // `next-env.d.ts` versionado para apontar para `.next-e2e`; o original é restaurado
  // para o E2E não deixar o repositório com alteração pendente.
  const webDir = path.join(ROOT, 'apps', 'web');
  const nextEnvPath = path.join(webDir, 'next-env.d.ts');
  const nextEnv = readFileSync(nextEnvPath, 'utf8');

  try {
    run('npx next build', webDir, { NODE_ENV: 'production' });
  } finally {
    writeFileSync(nextEnvPath, nextEnv);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
