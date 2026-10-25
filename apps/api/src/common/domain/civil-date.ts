/**
 * Datas civis (DATE) tratadas como `YYYY-MM-DD` sem fuso (DT-008). No banco, Prisma
 * representa DATE como meia-noite UTC; estas funções fazem a conversão nas bordas.
 */
const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCivilDate(value: string): boolean {
  const match = CIVIL_DATE.exec(value);

  if (!match) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function civilToDate(value: string): Date {
  if (!isCivilDate(value)) {
    throw new Error(`Data civil inválida: ${value}`);
  }

  return new Date(`${value}T00:00:00Z`);
}

export function dateToCivil(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function optionalCivil(value: Date | null | undefined): string | null {
  return value ? dateToCivil(value) : null;
}

/** Data civil corrente no fuso informado (padrão: fuso do time). */
export function todayIn(timeZone = 'America/Rio_Branco', now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/** Idade completa em anos na data de referência. */
export function ageOn(birthDate: string, reference: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [ry, rm, rd] = reference.split('-').map(Number) as [number, number, number];
  let age = ry - by;

  if (rm < bm || (rm === bm && rd < bd)) {
    age -= 1;
  }

  return age;
}

export function addMonths(civil: string, months: number): string {
  const [y, m] = civil.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + months;

  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}

/** Primeiro dia do mês de uma data civil. */
export function monthStart(civil: string): string {
  return `${civil.slice(0, 7)}-01`;
}

/** Último dia do mês (1–31) de um mês `YYYY-MM-01`. */
export function daysInMonth(civil: string): number {
  const [y, m] = civil.split('-').map(Number) as [number, number];

  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Soma (ou subtrai) dias de uma data civil, sem depender de fuso. */
export function addDays(civil: string, days: number): string {
  const date = civilToDate(civil);

  date.setUTCDate(date.getUTCDate() + days);

  return dateToCivil(date);
}
