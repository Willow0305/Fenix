import { createHash, randomBytes } from 'node:crypto';

/** Token opaco aleatório (base64url) para refresh, recuperação de senha e consultas seguras. */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 em hexadecimal; usado para armazenar somente o hash de tokens e identificadores. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
