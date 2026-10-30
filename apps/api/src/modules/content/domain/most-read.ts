import { civilToDate, dateToCivil } from '../../../common/domain/civil-date';

/** Janela de "mais lidas" (D5, DT-081): os últimos N dias civis, contando hoje. */
export const MOST_READ_DAYS = 7;

/** Primeiro dia civil da janela que termina em `today` (inclusive). */
export function windowStart(today: string, days: number = MOST_READ_DAYS): string {
  const start = civilToDate(today);

  start.setUTCDate(start.getUTCDate() - (Math.max(1, days) - 1));

  return dateToCivil(start);
}

/** Ordena por leituras e, no empate, pela notícia mais recente. */
export function rankMostRead<T extends { views: number; publishedAt: Date | null }>(
  rows: readonly T[],
  limit: number
): T[] {
  return [...rows]
    .filter((row) => row.views > 0)
    .sort(
      (a, b) =>
        b.views - a.views || (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
    )
    .slice(0, limit);
}
