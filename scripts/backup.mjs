#!/usr/bin/env node
/**
 * Backup completo do ambiente local (docs/15 §10.1, PEN-044, DT-038): banco PostgreSQL e
 * arquivos enviados. Cada execução cria uma pasta datada em BACKUP_DIR com:
 *
 * - `database.dump`: pg_dump em formato custom, lido por inteiro pelo `pg_restore`;
 * - `storage/`: cópia de STORAGE_LOCAL_DIR;
 * - `manifest.json`: instante, tamanhos, SHA-256 do dump e quantidade de arquivos.
 *
 * Mantém as BACKUP_KEEP cópias mais recentes (padrão 30). A DATA_ENCRYPTION_KEY nunca é
 * copiada: guarde-a separada do backup. Uso: `npm run backup`.
 */
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

const env = process.env;
const container = env.POSTGRES_CONTAINER ?? 'fenix-postgres-1';
const dbUser = required('POSTGRES_USER');
const dbName = required('POSTGRES_DB');
const backupRoot = absoluteDir('BACKUP_DIR');
const storageDir = resolve('apps/api', env.STORAGE_LOCAL_DIR ?? 'var/storage');
const keep = Math.max(1, Number(env.BACKUP_KEEP ?? 30) || 30);

function required(name) {
  const value = env[name];

  if (!value) {
    throw new Error(`Variável ${name} ausente no .env.`);
  }

  return value;
}

function absoluteDir(name) {
  const value = required(name);

  if (!isAbsolute(value)) {
    throw new Error(`${name} deve ser um caminho absoluto fora da pasta do projeto.`);
  }

  return value;
}

function stamp(date) {
  const p = (n) => String(n).padStart(2, '0');

  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

function dumpDatabase(target) {
  return new Promise((done, fail) => {
    const child = spawn(
      'docker',
      ['exec', container, 'pg_dump', '-U', dbUser, '-d', dbName, '-Fc'],
      {
        stdio: ['ignore', 'pipe', 'inherit']
      }
    );
    const out = createWriteStream(target);

    child.stdout.pipe(out);
    child.on('error', fail);
    child.on('close', (code) => {
      out.close();

      if (code === 0) {
        done();
      } else {
        fail(new Error(`pg_dump terminou com código ${code}.`));
      }
    });
  });
}

/**
 * Confere o dump inteiro: o pg_restore lê todo o arquivo e gera o SQL em /dev/null dentro
 * do contêiner, sem restaurar nada. Um dump truncado ou corrompido falha aqui.
 */
function verifyDump(target) {
  const inside = `/tmp/fenix-backup-check-${process.pid}.dump`;

  try {
    execFileSync('docker', ['cp', target, `${container}:${inside}`], { stdio: 'ignore' });
    execFileSync('docker', ['exec', container, 'pg_restore', '-f', '/dev/null', inside], {
      stdio: ['ignore', 'ignore', 'pipe']
    });
  } catch {
    throw new Error('O dump gerado não passou na verificação do pg_restore.');
  } finally {
    execFileSync('docker', ['exec', container, 'rm', '-f', inside], { stdio: 'ignore' });
  }
}

function sha256(file) {
  return new Promise((done, fail) => {
    const hash = createHash('sha256');

    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', fail)
      .on('end', () => done(hash.digest('hex')));
  });
}

async function countFiles(dir) {
  let total = 0;

  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    total += entry.isDirectory() ? await countFiles(join(dir, entry.name)) : 1;
  }

  return total;
}

async function prune() {
  const entries = (await readdir(backupRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && /^fenix-\d{8}-\d{6}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  for (const old of entries.slice(keep)) {
    await rm(join(backupRoot, old), { recursive: true, force: true });
    console.log(`Backup antigo removido: ${old}`);
  }
}

async function main() {
  execFileSync('docker', ['inspect', container], { stdio: 'ignore' });

  const startedAt = new Date();
  const target = join(backupRoot, `fenix-${stamp(startedAt)}`);
  const dumpFile = join(target, 'database.dump');

  await mkdir(target, { recursive: true });

  try {
    await dumpDatabase(dumpFile);
    verifyDump(dumpFile);
    await cp(storageDir, join(target, 'storage'), { recursive: true, errorOnExist: false });

    const manifest = {
      createdAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      database: {
        name: dbName,
        file: 'database.dump',
        bytes: (await stat(dumpFile)).size,
        sha256: await sha256(dumpFile)
      },
      storage: { source: storageDir, files: await countFiles(join(target, 'storage')) },
      note: 'DATA_ENCRYPTION_KEY não incluída: guarde-a separadamente (docs/15 §10.1).'
    };

    await writeFile(join(target, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await prune();
    console.log(
      `Backup concluído em ${target} (${manifest.database.bytes} bytes de banco, ${manifest.storage.files} arquivo(s)).`
    );
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    throw error;
  }
}

main().catch((error) => {
  console.error(`Backup falhou: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
