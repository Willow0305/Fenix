import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Cifra AES-256-GCM para campos confidenciais (PIX, dados bancários, documentos).
 * Formato: `v1.<iv>.<tag>.<ciphertext>` em base64url.
 */
export const DATA_KEY_VERSION = 'v1';

export function encryptField(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [DATA_KEY_VERSION, iv, tag, ciphertext]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

export function decryptField(payload: string, key: Buffer): string {
  const [version, iv, tag, ciphertext] = payload.split('.');

  if (version !== DATA_KEY_VERSION || !iv || !tag || ciphertext === undefined) {
    throw new Error('Formato de dado cifrado inválido.');
  }

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}
