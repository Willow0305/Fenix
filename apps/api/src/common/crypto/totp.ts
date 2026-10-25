import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238) com HMAC-SHA1, 6 dígitos e passo de 30 s — o padrão aceito por todos os
 * aplicativos autenticadores (DT-037).
 */
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Passos aceitos antes e depois do atual, para tolerar relógios levemente defasados. */
export const TOTP_WINDOW = 1;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=]/g, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);

    if (index === -1) {
      throw new Error('Segredo TOTP inválido.');
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** Segredo de 160 bits (tamanho recomendado para HMAC-SHA1) em base32. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpStep(now: Date): number {
  return Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SECONDS);
}

export function totpCode(secret: string, step: number, digits = TOTP_DIGITS): string {
  const counter = Buffer.alloc(8);

  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 15;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;

  return String(binary % 10 ** digits).padStart(digits, '0');
}

/**
 * Retorna o passo do código aceito ou `null`. Passos iguais ou anteriores a `lastUsedStep`
 * são recusados, impedindo reutilizar um código já usado (replay).
 */
export function verifyTotp(
  secret: string,
  code: string,
  now: Date,
  lastUsedStep: number | null
): number | null {
  const normalized = code.replace(/\s/g, '');

  if (!/^\d{6}$/.test(normalized)) {
    return null;
  }

  const current = totpStep(now);

  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta += 1) {
    const step = current + delta;

    if (lastUsedStep !== null && step <= lastUsedStep) {
      continue;
    }

    const expected = Buffer.from(totpCode(secret, step));

    if (timingSafeEqual(expected, Buffer.from(normalized))) {
      return step;
    }
  }

  return null;
}

/** URI `otpauth://` lida pelos aplicativos autenticadores via QR code. */
export function totpUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS)
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}
