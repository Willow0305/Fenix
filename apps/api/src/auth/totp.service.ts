import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;

function encodeBase32(value: Buffer): string {
  let bits = 0;
  let accumulator = 0;
  let encoded = '';

  for (const byte of value) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      encoded += BASE32_ALPHABET[(accumulator >>> bits) & 31];
    }
  }

  if (bits > 0) {
    encoded += BASE32_ALPHABET[(accumulator << (5 - bits)) & 31];
  }

  return encoded;
}

function decodeBase32(value: string): Buffer {
  const normalized = value.replace(/=+$/u, '').replace(/\s+/gu, '').toUpperCase();
  let bits = 0;
  let accumulator = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);

    if (index < 0) {
      throw new Error('Segredo TOTP em base32 inválido.');
    }

    accumulator = (accumulator << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((accumulator >>> bits) & 255);
    }
  }

  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(counterBuffer).digest();
  const offset = (digest.at(-1) ?? 0) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

@Injectable()
export class TotpService {
  public createSecret(): string {
    return encodeBase32(randomBytes(20));
  }

  public codeAt(secret: string, instant: Date): string {
    return hotp(decodeBase32(secret), this.stepAt(instant));
  }

  public verify(
    secret: string,
    suppliedCode: string,
    instant: Date,
    lastUsedStep?: number | null
  ): number | undefined {
    if (!/^\d{6}$/u.test(suppliedCode)) {
      return undefined;
    }

    const currentStep = this.stepAt(instant);
    const supplied = Buffer.from(suppliedCode);

    for (const offset of [-1, 0, 1]) {
      const candidateStep = currentStep + offset;

      if (
        candidateStep < 0 ||
        (lastUsedStep !== null && lastUsedStep !== undefined && candidateStep <= lastUsedStep)
      ) {
        continue;
      }

      const expected = Buffer.from(hotp(decodeBase32(secret), candidateStep));

      if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) {
        return candidateStep;
      }
    }

    return undefined;
  }

  public buildOtpAuthUri(secret: string, email: string): string {
    const issuer = 'Fênix Vôlei';
    const label = `${issuer}:${email}`;
    const parameters = new URLSearchParams({
      algorithm: 'SHA1',
      digits: String(TOTP_DIGITS),
      issuer,
      period: String(TOTP_PERIOD_SECONDS),
      secret
    });

    return `otpauth://totp/${encodeURIComponent(label)}?${parameters.toString()}`;
  }

  private stepAt(instant: Date): number {
    return Math.floor(instant.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  }
}
