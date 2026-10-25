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
