import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { type APIRequestContext, expect, type Page } from '@playwright/test';

// Ambiente compartilhado com os scripts CommonJS do E2E (env.cjs).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ADMIN, ROOT } = require('../env.cjs') as {
  ADMIN: { email: string; password: string };
  ROOT: string;
};

export { ADMIN };

/**
 * Vigia a página durante o teste: erros de JavaScript e respostas 5xx da API são falhas.
 * Avisos de recurso 401/404 (ex.: "/me" sem login) fazem parte do fluxo normal.
 */
export function watch(page: Page): { problems: string[] } {
  const problems: string[] = [];

  page.on('pageerror', (error) => problems.push(`Erro de JavaScript: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 500) {
      problems.push(`${response.status()} em ${new URL(response.url()).pathname}`);
    }
  });
  page.on('console', (message) => {
    const text = message.text();

    if (message.type() === 'error' && !text.startsWith('Failed to load resource')) {
      problems.push(`Console: ${text.slice(0, 200)}`);
    }
  });

  return { problems };
}

/** Nada pode criar rolagem lateral (390 px e 1280 px). */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );

  expect(overflow, 'a página não pode rolar para o lado').toBeLessThanOrEqual(1);
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of input.replace(/[\s=]/g, '').toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** Código TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s), como o aplicativo autenticador. */
export function totp(secret: string, at: Date = new Date()): string {
  const counter = Buffer.alloc(8);

  counter.writeBigUInt64BE(BigInt(Math.floor(at.getTime() / 30_000)));

  const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 15;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;

  return String(code).padStart(6, '0');
}

/**
 * Estado do administrador entre processos do Playwright (um teste que falha reinicia o
 * processo): segredo da segunda etapa e última janela de código usada, que não vale de novo.
 * Fica em `var/` (fora do Git) e o `prepare.cjs` apaga a cada execução.
 */
const STATE_FILE = path.join(ROOT, 'var', 'e2e-admin-mfa.json');

type MfaState = { secret: string; lastWindow: number };

function readState(): MfaState | null {
  return existsSync(STATE_FILE) ? (JSON.parse(readFileSync(STATE_FILE, 'utf8')) as MfaState) : null;
}

function writeState(state: MfaState): void {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state));
}

/** Código de uma janela ainda não usada; se a atual já foi, espera a próxima. */
async function freshCode(state: MfaState): Promise<string> {
  let window = Math.floor(Date.now() / 30_000);

  if (window <= state.lastWindow) {
    await new Promise((resolve) =>
      setTimeout(resolve, (state.lastWindow + 1) * 30_000 - Date.now() + 250)
    );
    window = Math.floor(Date.now() / 30_000);
  }

  writeState({ ...state, lastWindow: window });

  return totp(state.secret, new Date(window * 30_000));
}

/** Ativa a segunda etapa do administrador do E2E pela API (uma vez por execução). */
export async function adminMfaSecret(request: APIRequestContext): Promise<string> {
  const saved = readState();

  if (saved) {
    return saved.secret;
  }

  const login = await request.post('/api/v1/auth/login', {
    data: { email: ADMIN.email, password: ADMIN.password }
  });

  expect(login.ok()).toBe(true);

  const { accessToken } = (await login.json()) as { accessToken: string };
  const headers = { Authorization: `Bearer ${accessToken}` };
  const setup = await request.post('/api/v1/me/mfa/setup', {
    headers,
    data: { password: ADMIN.password }
  });

  expect(setup.ok()).toBe(true);

  const secret = ((await setup.json()) as { secret: string }).secret;
  const enable = await request.post('/api/v1/me/mfa/enable', {
    headers,
    data: { code: await freshCode({ secret, lastWindow: 0 }) }
  });

  expect(enable.ok()).toBe(true);

  return secret;
}

/** Entra pelo site; com segredo, responde à segunda etapa com um código ainda não usado. */
export async function signIn(
  page: Page,
  email: string,
  password: string,
  secret?: string
): Promise<void> {
  await page.goto('/entrar');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  if (secret) {
    const code = page.getByLabel(/Código/);

    await code.waitFor();
    await code.fill(await freshCode(readState() ?? { secret, lastWindow: 0 }));
    await page.getByRole('button', { name: 'Verificar' }).click();
  }

  await page.waitForURL((url) => !url.pathname.startsWith('/entrar'), { timeout: 20_000 });
}

/** Espera a tela terminar de carregar (sem "Carregando…"); o site consulta avisos sem parar. */
export async function settled(page: Page): Promise<void> {
  await expect(page.getByText(/^Carregando/)).toHaveCount(0);
}

/**
 * Abre o primeiro produto com esse nome e põe no carrinho. Espera a página terminar de
 * carregar: clique antes de o React assumir o botão se perde (falha vista no celular).
 */
export async function addToCart(page: Page, name: RegExp): Promise<void> {
  await page.goto('/loja');
  await page.getByRole('link', { name }).first().click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /adicionar ao carrinho/i }).click();
  await expect(page.getByText('Adicionado ao carrinho')).toBeVisible();
}
