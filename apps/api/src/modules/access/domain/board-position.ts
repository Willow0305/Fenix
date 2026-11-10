/**
 * Cargo na diretoria (DT-102): texto livre com sugestões, até 80 caracteres, só para quem
 * tem o papel Diretoria. Atleta que também é da diretoria continua pagando mensalidade: a
 * cobrança segue o plano do atleta, nunca o cargo.
 */
export const BOARD_POSITION_MAX = 80;

export const BOARD_POSITION_SUGGESTIONS = [
  'Presidente',
  'Vice-presidente',
  'Tesoureiro(a)',
  'Secretário(a)',
  'Diretor(a) técnico(a)',
  'Diretor(a) de marketing',
  'Diretor(a) de eventos',
  'Conselheiro(a) fiscal'
] as const;

/** Espaços normais nas pontas e no meio; vazio vira "sem cargo". */
export function normalizeBoardPosition(value: string | null | undefined): string | null {
  const clean = (value ?? '').replace(/\s+/g, ' ').trim();

  return clean ? clean.slice(0, BOARD_POSITION_MAX) : null;
}
