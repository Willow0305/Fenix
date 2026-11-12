import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

/**
 * Chave para acompanhar um pedido ao vivo sem login (DT-116): pedido sem conta e entregador.
 * Vai junto com a consulta que a pessoa já pode fazer (código de acesso ou link da entrega)
 * e só permite receber o aviso "este pedido mudou", sem dados. Formato:
 * `<id do pedido>.<assinatura>`.
 */
const MAC_BYTES = 16;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const secrets = new WeakMap<Buffer, Buffer>();

/** Chave própria, derivada da chave de dados (nunca a mesma em dois usos). */
export function watchSecret(dataEncryptionKey: Buffer): Buffer {
  let secret = secrets.get(dataEncryptionKey);

  if (!secret) {
    secret = Buffer.from(
      hkdfSync('sha256', dataEncryptionKey, Buffer.alloc(0), 'realtime-watch-v1', 32)
    );
    secrets.set(dataEncryptionKey, secret);
  }

  return secret;
}

function mac(secret: Buffer, orderId: string): Buffer {
  return createHmac('sha256', secret)
    .update(`order:${orderId.toLowerCase()}`)
    .digest()
    .subarray(0, MAC_BYTES);
}

export function signWatchKey(secret: Buffer, orderId: string): string {
  return `${orderId.toLowerCase()}.${mac(secret, orderId).toString('base64url')}`;
}

/** Id do pedido, se a chave for válida; senão, nulo. */
export function verifyWatchKey(secret: Buffer, key: string): string | null {
  const [orderId, signature, ...rest] = key.split('.');

  if (!orderId || !signature || rest.length > 0 || !UUID.test(orderId)) {
    return null;
  }

  const given = Buffer.from(signature, 'base64url');
  const expected = mac(secret, orderId);

  return given.length === expected.length && timingSafeEqual(given, expected)
    ? orderId.toLowerCase()
    : null;
}
