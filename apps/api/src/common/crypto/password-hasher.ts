import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Hash de senha com scrypt (DT-022). Formato versionado:
 * `scrypt$v1$N$r$p$saltBase64$hashBase64`, permitindo elevar custos no futuro.
 */
const VERSION = 'v1';
const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 128 * COST * BLOCK_SIZE * 2;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      { N: n, r, p, maxmem: Math.max(MAX_MEMORY, 128 * n * r * 2) },
      (error, key) => (error ? reject(error) : resolve(key))
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, COST, BLOCK_SIZE, PARALLELIZATION);

  return [
    'scrypt',
    VERSION,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString('base64'),
    key.toString('base64')
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');

  if (parts.length !== 7 || parts[0] !== 'scrypt' || parts[1] !== VERSION) {
    return false;
  }

  const n = Number(parts[2]);
  const r = Number(parts[3]);
  const p = Number(parts[4]);
  const salt = Buffer.from(parts[5] ?? '', 'base64');
  const expected = Buffer.from(parts[6] ?? '', 'base64');

  if (
    !Number.isInteger(n) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    expected.length === 0
  ) {
    return false;
  }

  const actual = await derive(password, salt, n, r, p);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Hash fictício usado para igualar o tempo de resposta quando a conta não existe. */
export const DUMMY_PASSWORD_HASH =
  'scrypt$v1$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(KEY_LENGTH).toString('base64');
