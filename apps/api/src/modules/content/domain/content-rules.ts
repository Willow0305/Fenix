import type { EventStatus, ForumTopicStatus, ForumVisibility, NewsStatus } from '@prisma/client';

import type { TransitionTable } from '../../../common/domain/state-machine';

/** Regras puras de notícias, eventos, fórum e avisos (RF-040 a RF-043, RCF-001/012/013, DT-034). */

export const NEWS_STATUS_LABELS: Record<NewsStatus, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendada',
  PUBLISHED: 'Publicada',
  HIDDEN: 'Oculta',
  ARCHIVED: 'Arquivada'
};

/** Publicar/agendar é feito pela ação própria; aqui ficam as demais mudanças. */
export const NEWS_TRANSITIONS: TransitionTable<NewsStatus> = {
  DRAFT: ['SCHEDULED', 'PUBLISHED', 'ARCHIVED'],
  // Reagendar mantém o estado com novo instante.
  SCHEDULED: ['SCHEDULED', 'DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'],
  PUBLISHED: ['HIDDEN', 'ARCHIVED'],
  HIDDEN: ['PUBLISHED', 'SCHEDULED', 'ARCHIVED']
};

/** RN-COM-005: visível somente publicada/agendada e com `publishedAt` já alcançado (UTC). */
export function newsIsPublic(
  news: { status: NewsStatus; publishedAt: Date | null; deletedAt: Date | null },
  now: Date
): boolean {
  return (
    news.deletedAt === null &&
    (news.status === 'PUBLISHED' || news.status === 'SCHEDULED') &&
    news.publishedAt !== null &&
    news.publishedAt <= now
  );
}

/** Estado gravado ao publicar: agendada se o instante for futuro. */
export function publicationState(
  scheduledAt: Date | null,
  now: Date
): { status: NewsStatus; publishedAt: Date } {
  return scheduledAt !== null && scheduledAt > now
    ? { status: 'SCHEDULED', publishedAt: scheduledAt }
    : { status: 'PUBLISHED', publishedAt: now };
}

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Confirmado',
  CANCELLED: 'Cancelado',
  COMPLETED: 'Realizado'
};

export const EVENT_TRANSITIONS: TransitionTable<EventStatus> = {
  DRAFT: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['COMPLETED', 'CANCELLED', 'DRAFT'],
  CANCELLED: ['SCHEDULED']
};

export interface ForumViewer {
  readonly authenticated: boolean;
  readonly member: boolean;
  readonly staff: boolean;
}

export const ANONYMOUS: ForumViewer = { authenticated: false, member: false, staff: false };

/** RN-COM-001: quem pode ler cada visibilidade. */
export function canRead(visibility: ForumVisibility, viewer: ForumViewer): boolean {
  if (visibility === 'PUBLIC') {
    return true;
  }

  if (visibility === 'MEMBERS') {
    return viewer.member || viewer.staff;
  }

  return viewer.staff;
}

/** Visibilidades legíveis, para filtros de consulta (evita vazamento em listas e contagens). */
export function readableVisibilities(viewer: ForumViewer): ForumVisibility[] {
  return (['PUBLIC', 'MEMBERS', 'STAFF'] as const).filter((v) => canRead(v, viewer));
}

/** A visibilidade do tópico nunca é mais aberta que a da categoria. */
export function strictestVisibility(a: ForumVisibility, b: ForumVisibility): ForumVisibility {
  const order: ForumVisibility[] = ['PUBLIC', 'MEMBERS', 'STAFF'];

  return order[Math.max(order.indexOf(a), order.indexOf(b))] as ForumVisibility;
}

/** Tópicos que a comunidade vê; moderação vê também os ocultos. */
export function visibleTopicStatuses(viewer: ForumViewer): ForumTopicStatus[] {
  return viewer.staff ? ['PUBLISHED', 'CLOSED', 'HIDDEN'] : ['PUBLISHED', 'CLOSED'];
}

/** Caractere de controle que não é quebra de linha nem tabulação. */
function isControl(char: string): boolean {
  const code = char.charCodeAt(0);

  return (code < 32 && char !== '\n' && char !== '\t') || code === 127;
}

/**
 * Texto simples (DT-034): remove marcação HTML e caracteres de controle, normaliza quebras
 * de linha e limita linhas em branco consecutivas. A interface sempre renderiza como texto.
 */
export function sanitizeText(value: string): string {
  return [...value.replace(/\r\n?/g, '\n').replace(/<\/?[a-z][^>]*>/gi, '')]
    .filter((char) => !isControl(char))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface RateWindow {
  readonly recentCount: number;
  readonly limit: number;
}

/** Limite de postagem por janela (antiabuso, PEN-039). */
export function rateExceeded(window: RateWindow): boolean {
  return window.recentCount >= window.limit;
}

export const POST_RATE = { limit: 6, windowMs: 60_000 } as const;
export const TOPIC_RATE = { limit: 5, windowMs: 3_600_000 } as const;
export const REPORT_RATE = { limit: 10, windowMs: 3_600_000 } as const;

/** Prazo para o autor editar ou remover a própria mensagem. */
export const AUTHOR_EDIT_WINDOW_MS = 24 * 3_600_000;

export function authorCanEdit(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() <= AUTHOR_EDIT_WINDOW_MS;
}

export type BroadcastAudience = 'ACTIVE_ATHLETES' | 'TEAM' | 'STAFF' | 'ALL_USERS';

export const BROADCAST_AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
  ACTIVE_ATHLETES: 'Atletas ativos com conta',
  TEAM: 'Atletas de uma equipe',
  STAFF: 'Diretoria',
  ALL_USERS: 'Todos os usuários ativos'
};
