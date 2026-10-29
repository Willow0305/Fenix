/**
 * Ambiente dos testes de ponta a ponta (R-10): banco `<dev>_e2e` recriado a cada execução,
 * API e site em portas próprias, PIX em modo de teste e limites de requisição desligados.
 * Nada aqui é segredo de produção: são valores só para o banco descartável do E2E.
 */
const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const ROOT = path.resolve(__dirname, '..');
const API_PORT = 3433;
const WEB_PORT = 3100;

function e2eDatabaseUrl() {
  const dev = process.env.DATABASE_URL;

  if (!dev) {
    throw new Error('Defina DATABASE_URL no .env para rodar o E2E.');
  }

  const url = new URL(dev);

  url.pathname = `/${url.pathname.slice(1)}_e2e`;

  return url.toString();
}

const ADMIN = {
  email: 'e2e-admin@exemplo.test',
  password: 'Fenix-E2E-Senha-Forte-2026!',
  name: 'Administração E2E'
};

function e2eEnv() {
  return {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_URL: e2eDatabaseUrl(),
    API_PORT: String(API_PORT),
    API_HOST: '127.0.0.1',
    WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
    WEB_INTERNAL_URL: `http://127.0.0.1:${WEB_PORT}`,
    API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`,
    PIX_PROVIDER: 'sandbox',
    CARD_PROVIDER: 'sandbox',
    // Sem internet nos testes: o CEP não é consultado no ViaCEP (DT-075).
    POSTAL_CODE_LOOKUP: 'off',
    THROTTLE_DISABLED: 'true',
    THROTTLE_STORE: 'memory',
    SCHEDULED_JOBS: 'off',
    MAIL_DRIVER: 'outbox',
    WHATSAPP_DRIVER: 'off',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: path.join(ROOT, 'var', 'e2e-storage'),
    MAIL_OUTBOX_DIR: path.join(ROOT, 'var', 'e2e-mail'),
    NEXT_DIST_DIR: '.next-e2e',
    SEED_ADMIN_EMAIL: ADMIN.email,
    SEED_ADMIN_PASSWORD: ADMIN.password,
    SEED_ADMIN_NAME: ADMIN.name
  };
}

module.exports = { ROOT, API_PORT, WEB_PORT, ADMIN, e2eDatabaseUrl, e2eEnv };
