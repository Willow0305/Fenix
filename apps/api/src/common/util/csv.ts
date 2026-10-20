/**
 * CSV com separador ";" (padrão de planilhas pt-BR), escape de aspas e proteção contra
 * injeção de fórmulas: células de texto iniciadas por `=`, `+`, `-`, `@`, tabulação ou
 * retorno de carro recebem um apóstrofo, para que planilhas não as executem (DT-035).
 * Números continuam numéricos.
 */
export type CsvCell = string | number | null | undefined;

function neutralize(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = typeof value === 'number' ? String(value) : neutralize(value);

  return /[;"\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\n');
}

/** BOM UTF-8 para o Excel reconhecer acentuação. */
export const CSV_BOM = String.fromCharCode(0xfeff);
