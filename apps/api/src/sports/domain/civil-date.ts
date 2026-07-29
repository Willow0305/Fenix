export interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export const AGE_OF_MAJORITY_YEARS = 18;

const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function compareCivilDates(left: CivilDate, right: CivilDate): number {
  if (left.year !== right.year) {
    return left.year - right.year;
  }

  if (left.month !== right.month) {
    return left.month - right.month;
  }

  return left.day - right.day;
}

export function parseCivilDate(value: string): CivilDate {
  const match = CIVIL_DATE_PATTERN.exec(value);

  if (!match) {
    throw new RangeError('A data civil deve usar o formato YYYY-MM-DD.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    year < 1 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    throw new RangeError('A data civil informada não existe no calendário.');
  }

  return { year, month, day };
}

export function formatCivilDate(value: CivilDate): string {
  return `${value.year.toString().padStart(4, '0')}-${value.month
    .toString()
    .padStart(2, '0')}-${value.day.toString().padStart(2, '0')}`;
}

export function calculateAgeOnCivilDate(
  birthDateInput: string,
  referenceDateInput: string
): number {
  const birthDate = parseCivilDate(birthDateInput);
  const referenceDate = parseCivilDate(referenceDateInput);

  if (compareCivilDates(referenceDate, birthDate) < 0) {
    throw new RangeError('A data de referência não pode anteceder a data de nascimento.');
  }

  const birthdayHasOccurred =
    referenceDate.month > birthDate.month ||
    (referenceDate.month === birthDate.month && referenceDate.day >= birthDate.day);

  return referenceDate.year - birthDate.year - (birthdayHasOccurred ? 0 : 1);
}

export function isMinorOnCivilDate(birthDateInput: string, referenceDateInput: string): boolean {
  return calculateAgeOnCivilDate(birthDateInput, referenceDateInput) < AGE_OF_MAJORITY_YEARS;
}
