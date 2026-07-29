import { createHmac } from 'node:crypto';

import { formatCivilDate, parseCivilDate } from './civil-date';

export const ATHLETE_DUPLICATE_FINGERPRINT_VERSION = 'v1';

const FINGERPRINT_CONTEXT = 'fenix:athlete-duplicate-fingerprint:v1';
const MINIMUM_HMAC_KEY_BYTES = 32;

export interface AthleteDuplicateFingerprintInput {
  readonly fullName: string;
  readonly birthDate: string;
}

function normalizeName(value: string): string {
  return value
    .trim()
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('pt-BR');
}

export function createAthleteDuplicateFingerprint(
  input: AthleteDuplicateFingerprintInput,
  hmacKey: string
): string {
  if (Buffer.byteLength(hmacKey, 'utf8') < MINIMUM_HMAC_KEY_BYTES) {
    throw new RangeError('A chave HMAC do fingerprint deve possuir ao menos 32 bytes.');
  }

  const normalizedName = normalizeName(input.fullName);

  if (!normalizedName) {
    throw new RangeError('O nome necessário ao fingerprint não pode ficar vazio.');
  }

  const canonicalBirthDate = formatCivilDate(parseCivilDate(input.birthDate));
  const digest = createHmac('sha256', hmacKey)
    .update(FINGERPRINT_CONTEXT)
    .update('\0')
    .update(normalizedName)
    .update('\0')
    .update(canonicalBirthDate)
    .digest('hex');

  return `${ATHLETE_DUPLICATE_FINGERPRINT_VERSION}.${digest}`;
}
