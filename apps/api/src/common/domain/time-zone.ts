/**
 * Conversões entre datas civis no fuso do time e instantes UTC (DT-008). Usadas para
 * filtrar movimentos por dia/mês e para fechamento de caixa por período.
 */
export const TEAM_TIME_ZONE = 'America/Rio_Branco';

function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(instant);
  const get = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  );

  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Instante UTC do início (00:00) do dia civil no fuso informado. */
export function startOfDayInZone(civil: string, timeZone = TEAM_TIME_ZONE): Date {
  const [y, m, d] = civil.split('-').map(Number) as [number, number, number];
  const guess = new Date(Date.UTC(y, m - 1, d));
  const offset = offsetMinutes(guess, timeZone);
  const candidate = new Date(guess.getTime() - offset * 60_000);
  const corrected = offsetMinutes(candidate, timeZone);

  return corrected === offset ? candidate : new Date(guess.getTime() - corrected * 60_000);
}

/** Instante exclusivo do fim do dia civil (início do dia seguinte). */
export function endOfDayExclusive(civil: string, timeZone = TEAM_TIME_ZONE): Date {
  const [y, m, d] = civil.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);

  return startOfDayInZone(next, timeZone);
}

/** Data civil de um instante no fuso informado. */
export function civilDateOf(instant: Date, timeZone = TEAM_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(instant);
}
