/**
 * Detecção do tipo real do arquivo pela assinatura binária (magic bytes), independente do
 * MIME informado pelo cliente. SVG e formatos com conteúdo ativo não são aceitos (DT-024).
 */
export type DetectedFileType = 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';

export const EXTENSIONS_BY_TYPE: Record<DetectedFileType, readonly string[]> = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf']
};

function startsWith(buffer: Buffer, bytes: readonly number[], offset = 0): boolean {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

export function detectFileType(buffer: Buffer): DetectedFileType | null {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }

  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }

  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }

  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return 'application/pdf';
  }

  return null;
}

export function extensionOf(fileName: string): string | null {
  const match = /\.([a-z0-9]{1,10})$/i.exec(fileName);

  return match?.[1]?.toLowerCase() ?? null;
}

/** Nome exibível seguro: sem caminho, controles ou caracteres problemáticos. */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? 'arquivo';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, '').trim();

  return (cleaned || 'arquivo').slice(0, 200);
}
