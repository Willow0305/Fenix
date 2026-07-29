import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

export function createOpaqueSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function createNumericCode(length: number): string {
  const limit = 10 ** length;
  const value = randomInt(0, limit);

  return value.toString().padStart(length, '0');
}

export function hashSecret(secret: string, pepper: string, context: string): string {
  return createHmac('sha256', pepper).update(context).update('\0').update(secret).digest('hex');
}

export function safelyEqualHash(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function hashRequestValue(value: string | undefined, pepper: string): string | undefined {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return undefined;
  }

  return hashSecret(normalizedValue, pepper, 'request-context');
}
