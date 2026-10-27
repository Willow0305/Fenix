import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

/**
 * Códigos do QR da carteirinha (DT-068). Só levam o id da carteirinha, a versão e a
 * assinatura; nenhum dado pessoal.
 *
 * - No celular (`c1`): muda a cada minuto e vale na janela atual e na anterior, então print
 *   antigo não serve.
 * - Impresso (`p1`): fixo, porque papel não muda; vale enquanto a versão for a atual.
 *
 * Reemitir a carteirinha (versão nova) invalida na hora os dois.
 */
export const CARD_WINDOW_MS = 60_000;
const LIVE = 'c1';
const PRINTED = 'p1';
const MAC_BYTES = 16;

export type CardTokenError = 'MALFORMED' | 'SIGNATURE' | 'EXPIRED';

export interface CardTokenPayload {
  readonly cardId: string;
  readonly version: number;
  readonly printed: boolean;
}

/** Chave própria da carteirinha, derivada da chave de dados (nunca a mesma em dois usos). */
export function cardKey(dataEncryptionKey: Buffer): Buffer {
  return Buffer.from(hkdfSync('sha256', dataEncryptionKey, Buffer.alloc(0), 'member-card-v1', 32));
}

export function cardWindow(now: Date): number {
  return Math.floor(now.getTime() / CARD_WINDOW_MS);
}

/** Até quando vale um código do celular emitido agora (fim da próxima janela). */
export function liveValidUntil(now: Date): Date {
  return new Date((cardWindow(now) + 2) * CARD_WINDOW_MS);
}

/** Milissegundos até o código do celular mudar. */
export function msToNextWindow(now: Date): number {
  return (cardWindow(now) + 1) * CARD_WINDOW_MS - now.getTime();
}

function uuidToBase64Url(uuid: string): string {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex').toString('base64url');
}

function base64UrlToUuid(value: string): string | null {
  const hex = Buffer.from(value, 'base64url').toString('hex');

  if (hex.length !== 32) {
    return null;
  }

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function mac(key: Buffer, body: string): string {
  return createHmac('sha256', key)
    .update(body)
    .digest()
    .subarray(0, MAC_BYTES)
    .toString('base64url');
}

function sameMac(given: string, expected: string): boolean {
  const a = Buffer.from(given, 'base64url');
  const b = Buffer.from(expected, 'base64url');

  return a.length === b.length && timingSafeEqual(a, b);
}

export function signLiveToken(key: Buffer, cardId: string, version: number, now: Date): string {
  const body = `${LIVE}.${uuidToBase64Url(cardId)}.${version.toString(36)}.${cardWindow(now).toString(36)}`;

  return `${body}.${mac(key, body)}`;
}

export function signPrintedToken(key: Buffer, cardId: string, version: number): string {
  const body = `${PRINTED}.${uuidToBase64Url(cardId)}.${version.toString(36)}`;

  return `${body}.${mac(key, body)}`;
}

export function verifyCardToken(
  key: Buffer,
  token: string,
  now: Date
): CardTokenPayload | { readonly error: CardTokenError } {
  const parts = token.split('.');
  const printed = parts[0] === PRINTED;

  if ((printed && parts.length !== 4) || (!printed && (parts[0] !== LIVE || parts.length !== 5))) {
    return { error: 'MALFORMED' };
  }

  const cardId = base64UrlToUuid(parts[1] ?? '');
  const version = Number.parseInt(parts[2] ?? '', 36);
  const window = printed ? 0 : Number.parseInt(parts[3] ?? '', 36);

  if (cardId === null || !Number.isSafeInteger(version) || !Number.isSafeInteger(window)) {
    return { error: 'MALFORMED' };
  }

  const body = parts.slice(0, -1).join('.');

  if (!sameMac(parts[parts.length - 1] ?? '', mac(key, body))) {
    return { error: 'SIGNATURE' };
  }

  if (!printed) {
    const current = cardWindow(now);

    if (window > current || window < current - 1) {
      return { error: 'EXPIRED' };
    }
  }

  return { cardId, version, printed };
}
