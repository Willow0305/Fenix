/**
 * Sobe a API (`node e2e/start.cjs api`) ou o site (`node e2e/start.cjs web`) do E2E com o
 * ambiente de `env.cjs`. Usado pelo `webServer` do Playwright.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');

const { ROOT, WEB_PORT, e2eEnv } = require('./env.cjs');

const which = process.argv[2];
const child =
  which === 'api'
    ? spawn(process.execPath, ['dist/main.js'], {
        cwd: path.join(ROOT, 'apps', 'api'),
        env: e2eEnv(),
        stdio: 'inherit'
      })
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
