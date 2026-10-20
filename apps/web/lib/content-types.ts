import type { Page } from './api-types';

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
  match: {
    opponentName: string;
    competitionName: string | null;
    isHome: boolean;
    teamScore: number | null;
    opponentScore: number | null;
    team: { id: string; name: string } | null;
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

/** Placar de partida: "Fênix 3 x 1 Adversário" (ou "a definir"). */
export function scoreLabel(match: NonNullable<TeamEvent['match']>, teamName = 'Fênix'): string {
  if (match.teamScore === null || match.opponentScore === null) {
    return `${teamName} x ${match.opponentName}`;
  }

  return match.isHome
    ? `${teamName} ${match.teamScore} x ${match.opponentScore} ${match.opponentName}`
    : `${match.opponentName} ${match.opponentScore} x ${match.teamScore} ${teamName}`;
}
