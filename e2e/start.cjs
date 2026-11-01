/**
 * Sobe a API (`node e2e/start.cjs api`) ou o site (`node e2e/start.cjs web`) do E2E com o
 * ambiente de `env.cjs`. Usado pelo `webServer` do Playwright.
 *
 * O log da API (JSON, com registro de acesso e pilha dos erros) fica em `var/e2e-logs/api.log`,
 * para investigar falhas intermitentes depois da execução (PEN-070).
 */
const { spawn } = require('node:child_process');
const { createWriteStream, mkdirSync } = require('node:fs');
const path = require('node:path');

const { ROOT, WEB_PORT, e2eEnv } = require('./env.cjs');

function startApi() {
  const dir = path.join(ROOT, 'var', 'e2e-logs');

  mkdirSync(dir, { recursive: true });

  const log = createWriteStream(path.join(dir, 'api.log'), { flags: 'w' });
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: path.join(ROOT, 'apps', 'api'),
    env: { ...e2eEnv(), LOG_FORMAT: 'json', ACCESS_LOG: 'on' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  // Erros continuam visíveis no terminal do Playwright.
  child.stderr.pipe(process.stderr);

  return child;
}

const which = process.argv[2];
const child =
  which === 'api'
    ? startApi()
    : spawn(
        process.execPath,
        [
          require.resolve('next/dist/bin/next', { paths: [path.join(ROOT, 'apps', 'web')] }),
          'start',
          '-p',
          String(WEB_PORT)
        ],
        {
          cwd: path.join(ROOT, 'apps', 'web'),
          env: { ...e2eEnv(), NODE_ENV: 'production' },
          stdio: 'inherit'
        }
      );

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code) => process.exit(code ?? 0));
