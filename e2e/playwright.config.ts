import { defineConfig, devices } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- env.cjs também serve os scripts CommonJS
const { API_PORT, WEB_PORT } = require('./env.cjs') as { API_PORT: number; WEB_PORT: number };

/**
 * Testes de ponta a ponta (R-10) em celular (390 px) e computador (1280 px). Usa o Edge
 * instalado (`E2E_CHANNEL`, padrão `msedge`), sem baixar navegador. Rode `npm run e2e`.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: '../test-results',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: '../playwright-report', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: process.env['E2E_CHANNEL'] ?? 'msedge',
    locale: 'pt-BR',
    timezoneId: 'America/Rio_Branco',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'celular',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        channel: process.env['E2E_CHANNEL'] ?? 'msedge'
      }
    },
    {
      name: 'computador',
      use: { viewport: { width: 1280, height: 800 } }
    }
  ],
  webServer: [
    {
      command: 'node e2e/start.cjs api',
      cwd: '..',
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: 'node e2e/start.cjs web',
      cwd: '..',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
});
