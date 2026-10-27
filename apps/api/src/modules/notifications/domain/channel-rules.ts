import type { NotificationCategory } from '../../../generated/prisma/client';

import { addDays } from '../../../common/domain/civil-date';
import { startOfDayInZone } from '../../../common/domain/time-zone';

/** Canais externos; o aviso no painel (`IN_APP`) sempre existe. */
export type ExternalChannel = 'EMAIL' | 'WHATSAPP';

export const EXTERNAL_CHANNELS: readonly ExternalChannel[] = ['EMAIL', 'WHATSAPP'];

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  FINANCE: 'Mensalidades e pagamentos',
  STORE: 'Pedidos da loja',
  SPORTS: 'Seletivas, inscrições e cadastro de atleta',
  AGENDA: 'Atendimentos com parceiros',
  ANNOUNCEMENTS: 'Avisos da diretoria',
  COMMUNITY: 'Fórum: respostas aos meus tópicos e moderação',
  ACCOUNT: 'Conta e privacidade',
  OPERATIONS: 'Tarefas da diretoria',
  NEWS: 'Notícias do clube',
  EVENTS: 'Eventos e jogos',
  FORUM_TOPICS: 'Novos tópicos no fórum'
};

/**
 * Finalidades de conteúdo (DT-067): só quem liga e-mail ou WhatsApp recebe, inclusive o
 * aviso no painel, para ninguém ser inundado com o que não pediu.
 */
export const CONTENT_CATEGORIES: readonly NotificationCategory[] = [
  'NEWS',
  'EVENTS',
  'FORUM_TOPICS'
];

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as NotificationCategory[];

/** Finalidade pelo prefixo do tipo da notificação (`fee.created` → FINANCE). */
const PREFIX_CATEGORY: readonly (readonly [string, NotificationCategory])[] = [
  ['fee.', 'FINANCE'],
  ['order.', 'STORE'],
  ['campaign.', 'STORE'],
  ['tryout', 'SPORTS'],
  ['athlete.', 'SPORTS'],
  ['appointment.', 'AGENDA'],
  ['announcement', 'ANNOUNCEMENTS'],
  ['content.news', 'NEWS'],
  ['content.event', 'EVENTS'],
  ['content.forum_topic', 'FORUM_TOPICS'],
  ['forum.', 'COMMUNITY'],
  ['privacy.', 'ACCOUNT'],
  ['staff.', 'OPERATIONS']
];

export function categoryOf(type: string): NotificationCategory {
  return PREFIX_CATEGORY.find(([prefix]) => type.startsWith(prefix))?.[1] ?? 'ACCOUNT';
}

/**
 * Padrão sem escolha registrada (DT-048): e-mail ligado para avisos de serviço (cobrança,
 * pedido, inscrição, agenda, diretoria); fórum e conta ficam só no painel. Notícias,
 * eventos e novos tópicos começam desligados: a pessoa escolhe receber (DT-067). WhatsApp
 * segue o mesmo padrão, mas só vale depois do consentimento da pessoa.
 */
const DEFAULT_ON: ReadonlySet<NotificationCategory> = new Set([
  'FINANCE',
  'STORE',
  'SPORTS',
  'AGENDA',
  'ANNOUNCEMENTS'
]);

export function defaultEnabled(category: NotificationCategory): boolean {
  return DEFAULT_ON.has(category);
}

export interface ChannelPreference {
  readonly category: NotificationCategory;
  readonly channel: string;
  readonly enabled: boolean;
}

export interface Recipient {
  readonly email: string | null;
  /** Número internacional para WhatsApp (`whatsappNumber`), ou nulo. */
  readonly whatsapp: string | null;
  readonly whatsappOptIn: boolean;
}

export function preferenceEnabled(
  preferences: readonly ChannelPreference[],
  category: NotificationCategory,
  channel: ExternalChannel
): boolean {
  const chosen = preferences.find((p) => p.category === category && p.channel === channel);

  return chosen ? chosen.enabled : defaultEnabled(category);
}

/** Canais externos em que o aviso deve sair, pela escolha da pessoa e pelo que é possível. */
export function channelsFor(
  category: NotificationCategory,
  preferences: readonly ChannelPreference[],
  recipient: Recipient,
  available: ReadonlySet<ExternalChannel>
): ExternalChannel[] {
  return EXTERNAL_CHANNELS.filter((channel) => {
    if (!available.has(channel) || !preferenceEnabled(preferences, category, channel)) {
      return false;
    }

    return channel === 'EMAIL'
      ? recipient.email !== null
      : recipient.whatsapp !== null && recipient.whatsappOptIn;
  });
}

/**
 * Número de WhatsApp a partir do telefone guardado só com dígitos. Aceita celular
 * brasileiro com DDD (11 dígitos, começando por 9 depois do DDD), com ou sem o 55.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  const national = digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits;

  if (!/^[1-9]{2}9\d{8}$/.test(national)) {
    return null;
  }

  return `55${national}`;
}

/** Espera entre tentativas: 1 min, 5 min, 30 min e 2 h; depois disso, falha. */
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

export function retryDelayMs(attempts: number): number | null {
  return attempts < MAX_ATTEMPTS ? (RETRY_DELAYS_MS[attempts - 1] ?? null) : null;
}

/** WhatsApp não sai entre 21h e 8h no fuso do clube; e-mail sai a qualquer hora. */
export const QUIET_START_HOUR = 21;
export const QUIET_END_HOUR = 8;

function hourIn(instant: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(
      instant
    )
  );
}

/** Próximo instante permitido para WhatsApp: o próprio `now` ou as 8h seguintes. */
export function whatsappSendAt(now: Date, timeZone: string): Date {
  const hour = hourIn(now, timeZone);

  if (hour >= QUIET_END_HOUR && hour < QUIET_START_HOUR) {
    return now;
  }

  const civil = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
  const day = hour >= QUIET_START_HOUR ? addDays(civil, 1) : civil;

  return new Date(startOfDayInZone(day, timeZone).getTime() + QUIET_END_HOUR * 3_600_000);
}

export type FeeReminderKind = 'due-soon' | 'due-today' | 'overdue-1' | 'overdue-7';

/**
 * Lembrete de mensalidade em aberto (DT-048): 3 dias antes, no dia, 1 e 7 dias depois do
 * vencimento. Cada tipo sai uma vez por mensalidade (chave de deduplicação).
 */
export function feeReminderKind(dueDate: string, today: string): FeeReminderKind | null {
  if (addDays(today, 3) === dueDate) {
    return 'due-soon';
  }

  if (today === dueDate) {
    return 'due-today';
  }

  if (addDays(dueDate, 1) === today) {
    return 'overdue-1';
  }

  return addDays(dueDate, 7) === today ? 'overdue-7' : null;
}

/** Datas de vencimento que geram lembrete hoje, para a consulta ao banco. */
export function feeReminderDueDates(today: string): string[] {
  return [addDays(today, 3), today, addDays(today, -1), addDays(today, -7)];
}

export function feeReminderText(
  kind: FeeReminderKind,
  referenceMonth: string,
  dueDate: string
): { title: string; message: string } {
  const month = `${referenceMonth.slice(5, 7)}/${referenceMonth.slice(0, 4)}`;
  const due = `${dueDate.slice(8, 10)}/${dueDate.slice(5, 7)}`;

  switch (kind) {
    case 'due-soon':
      return {
        title: 'Mensalidade vence em 3 dias',
        message: `A mensalidade de ${month} vence em ${due}. Confira o valor e pague pelo PIX em Minha conta.`
      };
    case 'due-today':
      return {
        title: 'Mensalidade vence hoje',
        message: `A mensalidade de ${month} vence hoje (${due}). Se já pagou, envie o comprovante em Minha conta.`
      };
    default:
      return {
        title: 'Mensalidade em atraso',
        message: `A mensalidade de ${month} venceu em ${due} e ainda está em aberto. Se já pagou, envie o comprovante em Minha conta; se precisar, fale com a diretoria.`
      };
  }
}

export interface OutgoingContent {
  readonly firstName: string;
  readonly title: string;
  readonly message: string;
  /** Endereço completo do site para o link do aviso. */
  readonly url: string;
  readonly preferencesUrl: string;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function emailText(content: OutgoingContent): { subject: string; text: string } {
  return {
    subject: `${content.title} — Fênix Vôlei`,
    text: [
      `Olá, ${content.firstName}.`,
      '',
      content.message,
      '',
      `Acesse: ${content.url}`,
      '',
      '—',
      'Fênix Vôlei. Esta é uma mensagem automática; para falar com a diretoria, use os contatos do site.',
      `Para escolher quais avisos receber por e-mail: ${content.preferencesUrl}`
    ].join('\n')
  };
}

/**
 * Parâmetros do modelo de mensagem do WhatsApp: nome, título, texto e link. A plataforma
 * recusa quebras de linha, tabulações e mais de 4 espaços seguidos em parâmetros.
 */
export function whatsappParameters(content: OutgoingContent): string[] {
  const clean = (value: string, max: number) =>
    value
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/ {2,}/g, ' ')
      .trim()
      .slice(0, max);

  return [
    clean(content.firstName, 60),
    clean(content.title, 120),
    clean(content.message, 700),
    clean(content.url, 300)
  ];
}
