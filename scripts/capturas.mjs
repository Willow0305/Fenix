// Capturas de tela do site e do painel, no computador (1366 px) e no celular (390 px), para
// comparar antes e depois de cada etapa (docs/31, Onda 0). Só para o ambiente local.
//
// Uso: npm run capturas -- [rótulo] [filtro]
//   rótulo: nome da pasta em var/capturas/ (padrão: data e hora)
//   filtro: só as rotas que contêm esse texto (ex.: "loja", "admin/caixa"); "=admin" só a rota exata
// O painel usa a conta criada por `npm run capturas:conta` (segunda etapa ativada aqui).
// Navegador: o Chromium do Playwright ou, se faltar, o Edge (CAPTURAS_NAVEGADOR=msedge|chrome).
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = (process.env.CAPTURAS_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const ACCOUNT_FILE = path.join(ROOT, 'var', 'capturas-conta.json');
const [label = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'), filter = ''] =
  process.argv.slice(2);
const OUT = path.join(ROOT, 'var', 'capturas', label);
const VIEWPORTS = [
  { tag: 'computador', width: 1366, height: 860 },
  { tag: 'celular', width: 390, height: 844 }
];

if (!['localhost', '127.0.0.1'].includes(new URL(BASE).hostname)) {
  throw new Error('As capturas só rodam contra o ambiente local.');
}

/** Rotas sem parâmetro, lidas das pastas de app/ (grupos como "(site)" não entram na URL). */
function staticRoutes(dir = path.join(ROOT, 'apps/web/app'), prefix = '') {
  const routes = [];

  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);

    if (!statSync(full).isDirectory()) {
      if (entry === 'page.tsx') {
        routes.push(prefix || '/');
      }

      continue;
    }

    if (entry.startsWith('[') || entry.startsWith('_') || entry === 'api') {
      continue;
    }

    const segment = entry.startsWith('(') ? '' : `/${entry}`;

    routes.push(...staticRoutes(full, prefix + segment));
  }

  return routes;
}

async function getJson(url) {
  const response = await fetch(BASE + url);

  return response.ok ? response.json() : null;
}

/** Um exemplo real de cada página com parâmetro, quando houver conteúdo publicado. */
async function dynamicRoutes() {
  const [products, news, events, categories] = await Promise.all([
    getJson('/api/v1/public/products?pageSize=1'),
    getJson('/api/v1/public/news?pageSize=1'),
    getJson('/api/v1/public/events?limit=1'),
    getJson('/api/v1/forum/categories')
  ]);
  const routes = [];
  const product = products?.data?.[0];
  const item = news?.data?.[0];
  const event = Array.isArray(events) ? events[0] : events?.data?.[0];
  const category = Array.isArray(categories) ? categories[0] : undefined;

  if (product) routes.push(`/loja/${product.slug}`);
  if (item) routes.push(`/noticias/${item.slug}`, `/admin/noticias/${item.id}`);
  if (event) routes.push(`/eventos/${event.slug}`);
  if (category?.slug) {
    routes.push(`/forum/${category.slug}`);

    const topics = await getJson(`/api/v1/forum/categories/${category.slug}/topics?pageSize=1`);
    const topic = topics?.topics?.data?.[0];

    if (topic?.id) routes.push(`/forum/topicos/${topic.id}`);
  }

  return routes;
}

// ---- Segunda etapa (TOTP, RFC 6238), igual aos testes ponta a ponta ----
function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes = [];

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

function totp(secret, step) {
  const counter = Buffer.alloc(8);

  counter.writeBigUInt64BE(BigInt(step));

  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;

  return String(code).padStart(6, '0');
}

/** Código ainda não usado: o servidor recusa repetir o código da mesma janela de 30 s. */
async function freshCode(account) {
  let step = Math.floor(Date.now() / 30_000);

  if (step <= (account.lastStep ?? 0)) {
    await new Promise((resolve) => setTimeout(resolve, (step + 1) * 30_000 - Date.now() + 250));
    step = Math.floor(Date.now() / 30_000);
  }

  account.lastStep = step;
  writeFileSync(ACCOUNT_FILE, JSON.stringify(account, null, 2), { mode: 0o600 });

  return totp(account.secret, step);
}

async function api(url, body, token) {
  const response = await fetch(`${BASE}/api/v1${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Falha em ${url}: ${response.status}`);
  }

  return response.json();
}

/** Ativa a segunda etapa da conta de capturas na primeira execução depois de criá-la. */
async function ensureMfa(account) {
  if (account.secret) {
    return;
  }

  const { accessToken } = await api('/auth/login', {
    email: account.email,
    password: account.password
  });
  const { secret } = await api('/me/mfa/setup', { password: account.password }, accessToken);

  account.secret = secret;
  await api('/me/mfa/enable', { code: await freshCode(account) }, accessToken);
}

async function signIn(page, account) {
  await page.goto(`${BASE}/entrar`);
  await page.locator('input[type=email]').fill(account.email);
  await page.locator('input[type=password]').fill(account.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  const code = page.getByLabel(/Código/);

  await code.waitFor({ timeout: 15_000 });
  await code.fill(await freshCode(account));
  await page.getByRole('button', { name: 'Verificar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/entrar'), { timeout: 20_000 });
}

async function launch() {
  const channel = process.env.CAPTURAS_NAVEGADOR;

  try {
    return await chromium.launch(channel ? { channel } : {});
  } catch {
    return chromium.launch({ channel: 'msedge' });
  }
}

async function main() {
  const all = [...staticRoutes(), ...(await dynamicRoutes())];
  // "=admin" captura só a rota exata; sem "=", toda rota que contém o texto.
  const matches = (route) =>
    filter.startsWith('=') ? route === `/${filter.slice(1)}` : route.includes(filter);
  const routes = [...new Set(all)].filter(matches).sort();
  const publicRoutes = routes.filter(
    (route) => !route.startsWith('/admin') && !route.startsWith('/minha-conta')
  );
  const privateRoutes = routes.filter((route) => !publicRoutes.includes(route));
  const account = existsSync(ACCOUNT_FILE) ? JSON.parse(readFileSync(ACCOUNT_FILE, 'utf8')) : null;

  if (privateRoutes.length > 0 && account === null) {
    console.warn('Sem conta de capturas: rode `npm run capturas:conta` para incluir o painel.');
  }

  if (account && privateRoutes.length > 0) {
    await ensureMfa(account);
  }

  mkdirSync(OUT, { recursive: true });

  const browser = await launch();
  let count = 0;

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }
    });
    const page = await context.newPage();
    const shoot = async (route) => {
      try {
        await page.goto(BASE + route, { waitUntil: 'load', timeout: 45_000 });
        await page.waitForTimeout(2_000);
      } catch {
        console.warn(`Demorou para carregar: ${route}`);
      }

      const name = `${viewport.tag}${route.replace(/\//g, '_') || '_inicio'}.png`;

      await page.screenshot({ path: path.join(OUT, name), fullPage: true });
      count += 1;
    };

    for (const route of publicRoutes) {
      await shoot(route);
    }

    if (account && privateRoutes.length > 0) {
      await signIn(page, account);

      for (const route of privateRoutes) {
        await shoot(route);
      }
    }

    await context.close();
  }

  await browser.close();
  console.log(`${count} capturas em ${OUT}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
