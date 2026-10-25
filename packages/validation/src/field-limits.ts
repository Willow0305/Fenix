/**
 * Limite de caracteres por tipo de campo (docs/29 §3.1, DT-040). O mesmo número vale no
 * banco (`@db.VarChar`), na API (`@MaxLength`) e na tela (`maxLength`).
 */
export const FIELD_LIMITS = {
  personName: 160,
  shortName: 120,
  title: 160,
  longTitle: 180,
  legalName: 180,
  email: 180,
  position: 80,
  location: 180,
  url: 300,
  summary: 500,
  reason: 1000,
  description: 2000,
  notes: 4000,
  content: 50_000,
  /** Com máscara: `000.000.000-00`. */
  cpf: 14,
  /** Com máscara: `00.000.000/0000-00`. */
  cnpj: 18,
  /** Com máscara: `(00) 00000-0000`. */
  phone: 15
} as const;

export type FieldLimit = keyof typeof FIELD_LIMITS;

/** A partir deste tamanho o campo mostra contador de caracteres. */
export const COUNTER_THRESHOLD = 200;
