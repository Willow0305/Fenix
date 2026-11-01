import { randomInt } from 'node:crypto';

import { sha256Hex } from '../../../common/crypto/tokens';

/**
 * Código de acesso do pedido sem conta (DT-096): 8 caracteres sem os que se confundem
 * (0/O, 1/I/L), mostrados em dois grupos (`K7QH-3MXP`). 31 símbolos, cerca de 40 bits; a consulta
 * exige também o número do pedido e tem limite de tentativas.
 */
export const GUEST_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const GUEST_CODE_LENGTH = 8;
const GUEST_CODE_PATTERN = new RegExp(`^[${GUEST_CODE_ALPHABET}]{${GUEST_CODE_LENGTH}}$`);

export function generateGuestCode(): string {
  return Array.from(
    { length: GUEST_CODE_LENGTH },
    () => GUEST_CODE_ALPHABET[randomInt(GUEST_CODE_ALPHABET.length)]
  ).join('');
}

/** `K7QH3MXP` → `K7QH-3MXP`. */
export function formatGuestCode(code: string): string {
  return GUEST_CODE_PATTERN.test(code) ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/**
 * Aceita o código como a pessoa digitar: minúsculas, espaços e traço. Código antigo (antes
 * de DT-096, 16 caracteres) segue exatamente como foi enviado.
 */
export function normalizeGuestCode(input: string): string {
  const compact = input.replace(/[\s-]/g, '').toUpperCase();

  return GUEST_CODE_PATTERN.test(compact) ? compact : input.trim();
}

/** Só o hash fica no banco para conferir o código. */
export function guestCodeHash(input: string): string {
  return sha256Hex(`order:${normalizeGuestCode(input)}`);
}

/**
 * Link fixo do pedido: número e código vão depois do `#`, que o navegador não envia ao
 * servidor nem a outros sites; o link é sempre o mesmo para o mesmo pedido.
 */
export function guestOrderPath(orderNumber: string, code: string): string {
  return `/loja/pedido#pedido=${encodeURIComponent(orderNumber)}&codigo=${encodeURIComponent(formatGuestCode(code))}`;
}
