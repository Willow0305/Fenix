import { formatPhone } from '@fenix/validation';

/** Formatação nas bordas (DT-008): instantes UTC exibidos no fuso do time; datas civis sem deslocamento. */
export const TEAM_TIME_ZONE = 'America/Rio_Branco';

export function formatDateTime(iso: string | null | undefined, timeZone = TEAM_TIME_ZONE): string {
  if (!iso) {
    return '—';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone
  }).format(new Date(iso));
}

/** Data civil `YYYY-MM-DD` exibida como `DD/MM/AAAA`, sem conversão de fuso. */
export function formatDate(civil: string | null | undefined): string {
  if (!civil) {
    return '—';
  }

  const [year, month, day] = civil.slice(0, 10).split('-');

  return year && month && day ? `${day}/${month}/${year}` : civil;
}

/** Valor decimal em string ("89.90") formatado sem conversão para float binário na soma. */
export function formatMoney(amount: string | null | undefined, currency = 'BRL'): string {
  if (amount === null || amount === undefined) {
    return '—';
  }

  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(amount));
}

export function formatMonth(civil: string | null | undefined): string {
  if (!civil) {
    return '—';
  }

  const [year, month] = civil.split('-');

  return month && year ? `${month}/${year}` : civil;
}

export function todayCivil(timeZone = TEAM_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

/** Telefone gravado só com dígitos exibido como `(68) 99999-0000` (DT-040). */
export function formatPhoneDisplay(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const digits = value.replace(/\D+/g, '');

  return digits.length === 10 || digits.length === 11 ? formatPhone(digits) : value;
}

/** "1 tópico", "3 tópicos", "0 tópicos": plural por extenso, sem "tópico(s)". */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? singular : pluralForm}`;
}

const RELATIVE = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

/**
 * Data relativa de conteúdo ("há 2 horas", "ontem", "há 3 dias"); depois de uma semana, a
 * data no fuso do time (docs/31, Onda 2). Instante futuro ou ausente cai na data completa.
 */
export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) {
    return '—';
  }

  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);

  if (minutes < 0) {
    return formatDateTime(iso);
  }

  if (minutes < 1) {
    return 'agora há pouco';
  }

  if (minutes < 60) {
    return RELATIVE.format(-minutes, 'minute');
  }

  if (minutes < 24 * 60) {
    return RELATIVE.format(-Math.floor(minutes / 60), 'hour');
  }

  const days = calendarDaysBetween(iso, now);

  return days < 7
    ? RELATIVE.format(-days, 'day')
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: TEAM_TIME_ZONE }).format(
        new Date(iso)
      );
}

/** Dias de calendário entre dois instantes, contados no fuso do time. */
export function calendarDaysBetween(iso: string, now: Date, timeZone = TEAM_TIME_ZONE): number {
  const civil = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);

  return Math.round(
    (Date.parse(civil(now)) - Date.parse(civil(new Date(iso)))) / (24 * 60 * 60 * 1000)
  );
}
