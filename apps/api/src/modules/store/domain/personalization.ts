import { createHash } from 'node:crypto';

/**
 * Personalização de produto (DT-069): nome e número na camisa e afins. Funções puras:
 * conferem e normalizam o que a pessoa digitou, calculam o acréscimo e a chave da linha.
 */
export interface PersonalizationField {
  readonly id: string;
  readonly label: string;
  readonly kind: 'TEXT' | 'NUMBER';
  readonly required: boolean;
  readonly maxLength: number | null;
  readonly minValue: number | null;
  readonly maxValue: number | null;
  readonly uppercase: boolean;
  /** Acréscimo em reais, como texto decimal ("15.00"). */
  readonly extraPrice: string;
}

export interface PersonalizationEntry {
  readonly fieldId: string;
  readonly label: string;
  readonly value: string;
  readonly extraPrice: string;
}

const TEXT_LIMIT = 30;
/** Letras (com acento), números, espaço, hífen, apóstrofo (reto ou do celular) e ponto. */
const TEXT_CHARS = /^[\p{L}\p{N} '’.-]*$/u;

export function normalizePersonalization(
  fields: readonly PersonalizationField[],
  input: Readonly<Record<string, string | null | undefined>>
): { values: Record<string, string>; problems: string[] } {
  const values: Record<string, string> = {};
  const problems: string[] = [];

  for (const field of fields) {
    const raw = (input[field.id] ?? '').toString().trim().replace(/\s+/g, ' ');

    if (raw === '') {
      if (field.required) {
        problems.push(`Preencha "${field.label}".`);
      }

      continue;
    }

    if (field.kind === 'NUMBER') {
      const min = field.minValue ?? 0;
      const max = field.maxValue ?? 99;

      if (!/^\d{1,6}$/.test(raw) || Number(raw) < min || Number(raw) > max) {
        problems.push(`"${field.label}" deve ser um número de ${min} a ${max}.`);
        continue;
      }

      values[field.id] = String(Number(raw));
      continue;
    }

    const limit = field.maxLength ?? TEXT_LIMIT;

    if (!TEXT_CHARS.test(raw)) {
      problems.push(`"${field.label}" aceita só letras, números, espaço, hífen e apóstrofo.`);
      continue;
    }

    if ([...raw].length > limit) {
      problems.push(`"${field.label}" pode ter no máximo ${limit} caracteres.`);
      continue;
    }

    values[field.id] = field.uppercase ? raw.toLocaleUpperCase('pt-BR') : raw;
  }

  return { values, problems };
}

/** Chave que distingue linhas da mesma variação com personalização diferente. */
export function personalizationKey(values: Readonly<Record<string, string>>): string {
  const entries = Object.entries(values).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    return '';
  }

  return createHash('sha256').update(JSON.stringify(entries)).digest('hex').slice(0, 32);
}

/** Cópia legível para o pedido e a planilha de produção (rótulo, valor e acréscimo). */
export function personalizationSnapshot(
  fields: readonly PersonalizationField[],
  values: Readonly<Record<string, string>>
): PersonalizationEntry[] {
  return fields
    .filter((field) => values[field.id] !== undefined)
    .map((field) => ({
      fieldId: field.id,
      label: field.label,
      value: values[field.id] as string,
      extraPrice: field.extraPrice
    }));
}

export function personalizationValuesOf(details: unknown): Record<string, string> {
  const values = (details as { personalization?: unknown } | null)?.personalization;

  if (values === null || typeof values !== 'object' || Array.isArray(values)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(values as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  );
}
