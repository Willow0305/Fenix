import { sha256Hex } from '../../../common/crypto/tokens';

/** Tipos de documento com versão (DT-089), na ordem do campo nas configurações. */
export const LEGAL_DOCUMENTS = [
  { kind: 'TERMS_OF_USE', field: 'termsOfUse' },
  { kind: 'PRIVACY_POLICY', field: 'privacyPolicy' }
] as const;

export type LegalKind = (typeof LEGAL_DOCUMENTS)[number]['kind'];
export type LegalField = (typeof LEGAL_DOCUMENTS)[number]['field'];

export interface LegalVersionRef {
  readonly version: number;
  readonly contentHash: string;
}

/** Texto vazio ou só com espaços não é documento publicado. */
export function publishedText(text: string | null | undefined): string | null {
  return text !== null && text !== undefined && text.trim() !== '' ? text : null;
}

export function legalHash(content: string): string {
  return sha256Hex(content);
}

/**
 * Próxima versão a criar quando o texto muda, ou `null` quando não há o que publicar:
 * texto vazio, ou idêntico (mesmo hash) à última versão.
 */
export function nextLegalVersion(
  text: string | null | undefined,
  latest: LegalVersionRef | null
): { version: number; contentHash: string; content: string } | null {
  const content = publishedText(text);

  if (content === null) {
    return null;
  }

  const contentHash = legalHash(content);

  if (latest !== null && latest.contentHash === contentHash) {
    return null;
  }

  return { version: (latest?.version ?? 0) + 1, contentHash, content };
}
