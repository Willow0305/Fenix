import type { Page } from './api-types';
import type { MoneyView } from './finance-types';
import { formatMoney } from './format';

export type NewsStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED';
export type EventType = 'TRYOUT' | 'MATCH' | 'FRIENDLY' | 'TRAINING' | 'COMMUNITY' | 'OTHER';
export type EventStatus = 'DRAFT' | 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
export type ForumVisibility = 'PUBLIC' | 'MEMBERS' | 'STAFF';
export type ForumTopicStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'HIDDEN' | 'ARCHIVED';
export type ForumPostStatus = 'PUBLISHED' | 'HIDDEN' | 'DELETED';
export type ReactionType = 'LIKE' | 'SUPPORT' | 'CELEBRATE';
export type ReportStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

export interface NewsCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
}

export interface NewsSummary {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  category: { id: string; name: string; slug: string };
  coverUrl: string | null;
  isFeatured: boolean;
  showOnHome: boolean;
  showOnForum: boolean;
  publishedAt: string | null;
  event: { id: string; title: string; slug: string; startsAt: string } | null;
  /** Assuntos da lista da diretoria (D8, DT-081). */
  tags: { id: string; name: string; slug: string }[];
}

/** Assunto de notícia (lista controlada pela diretoria). */
export interface NewsTag {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  newsCount?: number;
}

export interface NewsDetail extends NewsSummary {
  content: string;
  authorName: string | null;
  status?: NewsStatus;
  scheduledAt?: string | null;
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamEvent {
  id: string;
  title: string;
  slug: string;
  type: EventType;
  status: EventStatus;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  locationName: string | null;
  address: string | null;
  isPublic: boolean;
  publishedAt: string | null;
  coverUrl: string | null;
  match: {
    opponentName: string;
    competitionName: string | null;
    isHome: boolean;
    teamScore: number | null;
    opponentScore: number | null;
    team: { id: string; name: string } | null;
  } | null;
  /** Evento de outro organizador (D3, DT-081). */
  isExternal: boolean;
  organizerName: string | null;
  officialUrl: string | null;
  city: string | null;
  state: string | null;
  admission: { isFree: boolean; price: MoneyView | null };
  externalMatch: {
    homeTeamName: string;
    awayTeamName: string;
    competitionName: string | null;
    homeScore: number | null;
    awayScore: number | null;
  } | null;
  tryout: { id: string; title: string; slug: string } | null;
  news: { id: string; title: string; slug: string }[];
}

export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: ForumVisibility;
  isActive: boolean;
  topicCount: number;
  canPost: boolean;
}

export interface TopicSummary {
  id: string;
  title: string;
  status: ForumTopicStatus;
  visibility: ForumVisibility;
  isPinned: boolean;
  author: string | null;
  postCount: number;
  lastActivityAt: string;
  createdAt: string;
}

export interface ForumPost {
  id: string;
  author: { id: string; name: string } | null;
  parentPostId: string | null;
  content: string | null;
  status: ForumPostStatus;
  editedAt: string | null;
  createdAt: string;
  reactions: Record<ReactionType, number>;
  myReaction: ReactionType | null;
  canEdit: boolean;
}

export interface TopicDetail extends TopicSummary {
  category: { id: string; name: string; slug: string };
  posts: Page<ForumPost>;
  canReply: boolean;
  canModerate: boolean;
}

export interface ForumReport {
  id: string;
  target: 'TOPIC' | 'POST';
  topicId: string | null;
  postId: string | null;
  topicTitle: string | null;
  excerpt: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  reporter: string;
  resolution: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ModerationAction {
  id: string;
  action: string;
  topicId: string | null;
  postId: string | null;
  moderator: string;
  reason: string;
  createdAt: string;
}

export interface BroadcastHistoryItem {
  id: string;
  occurredAt: string;
  actor: string | null;
  audience: string;
  title: string;
  recipients: number;
}

export const NEWS_STATUS: Record<NewsStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Rascunho', badge: '' },
  SCHEDULED: { label: 'Agendada', badge: 'badge-info' },
  PUBLISHED: { label: 'Publicada', badge: 'badge-success' },
  HIDDEN: { label: 'Oculta', badge: 'badge-warning' },
  ARCHIVED: { label: 'Arquivada', badge: '' }
};

export const EVENT_TYPE: Record<EventType, string> = {
  TRYOUT: 'Seletiva',
  MATCH: 'Partida oficial',
  FRIENDLY: 'Amistoso',
  TRAINING: 'Treino',
  COMMUNITY: 'Ação com a comunidade',
  OTHER: 'Outro'
};

export const EVENT_STATUS: Record<EventStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Rascunho', badge: '' },
  SCHEDULED: { label: 'Confirmado', badge: 'badge-success' },
  CANCELLED: { label: 'Cancelado', badge: 'badge-danger' },
  COMPLETED: { label: 'Realizado', badge: 'badge-info' }
};

export const FORUM_VISIBILITY: Record<ForumVisibility, string> = {
  PUBLIC: 'Pública (qualquer pessoa lê; contas participam)',
  MEMBERS: 'Membros (atletas e diretoria)',
  STAFF: 'Diretoria'
};

export const REACTIONS: Record<ReactionType, { label: string; icon: string }> = {
  LIKE: { label: 'Curtir', icon: '👍' },
  SUPPORT: { label: 'Apoiar', icon: '💪' },
  CELEBRATE: { label: 'Comemorar', icon: '🎉' }
};

export const REPORT_STATUS: Record<ReportStatus, { label: string; badge: string }> = {
  OPEN: { label: 'Aberta', badge: 'badge-warning' },
  UNDER_REVIEW: { label: 'Em análise', badge: 'badge-info' },
  RESOLVED: { label: 'Resolvida', badge: 'badge-success' },
  DISMISSED: { label: 'Descartada', badge: '' }
};

/** Título do evento na agenda: placar do Fênix, jogo entre times de fora ou o título. */
export function eventHeadline(event: TeamEvent): string {
  if (event.match) {
    return scoreLabel(event.match);
  }

  const game = event.externalMatch;

  if (game) {
    return game.homeScore === null || game.awayScore === null
      ? `${game.homeTeamName} x ${game.awayTeamName}`
      : `${game.homeTeamName} ${game.homeScore} x ${game.awayScore} ${game.awayTeamName}`;
  }

  return event.title;
}

/** Cidade e UF ("Cruzeiro do Sul/AC"), ou o que houver. */
export function eventPlace(event: Pick<TeamEvent, 'city' | 'state'>): string | null {
  if (event.city && event.state) {
    return `${event.city}/${event.state}`;
  }

  return event.city ?? event.state;
}

/** "Entrada gratuita", "Entrada: R$ 15,50" ou nada quando a diretoria não informou. */
export function admissionLabel(event: Pick<TeamEvent, 'admission'>): string | null {
  // Resposta guardada em cache antes da atualização da API pode chegar sem o campo.
  const admission = event.admission as TeamEvent['admission'] | undefined;

  if (admission?.isFree) {
    return 'Entrada gratuita';
  }

  return admission?.price
    ? `Entrada: ${formatMoney(admission.price.amount, admission.price.currency)}`
    : null;
}

/** Placar de partida: "Fênix 3 x 1 Adversário" (ou "a definir"). */
export function scoreLabel(match: NonNullable<TeamEvent['match']>, teamName = 'Fênix'): string {
  if (match.teamScore === null || match.opponentScore === null) {
    return `${teamName} x ${match.opponentName}`;
  }

  return match.isHome
    ? `${teamName} ${match.teamScore} x ${match.opponentScore} ${match.opponentName}`
    : `${match.opponentName} ${match.opponentScore} x ${match.teamScore} ${teamName}`;
}
