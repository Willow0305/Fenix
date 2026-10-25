export type AthleteStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type Gender = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER' | 'NOT_INFORMED';
export type TeamType = 'MALE' | 'FEMALE' | 'MIXED' | 'OTHER';
export type TryoutStatus = 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';
export type RegistrationStatus =
  'NEW' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED';
export type InterestedStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'ARCHIVED';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  minimumAge: number | null;
  maximumAge: number | null;
  isActive: boolean;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  type: TeamType;
  description: string | null;
  isActive: boolean;
  category: { id: string; name: string } | null;
  activeAthletes?: number;
}

export interface Membership {
  id: string;
  team: { id: string; name: string; type: string };
  startsOn: string;
  endsOn: string | null;
  position: string | null;
  status: string;
}

export interface AthleteSummary {
  id: string;
  fullName: string;
  preferredName: string | null;
  birthDate: string | null;
  position: string | null;
  status: AthleteStatus;
  teams: string[];
  hasAccount: boolean;
}

/** Pendências exibidas antes de inativar ou suspender (docs/29 COR-018). */
export interface StatusImpact {
  cancellableFees: number;
  keptOpenFees: number;
  activePlan: { name: string } | null;
  openMemberships: { team: string }[];
}

export interface AthleteDetail extends AthleteSummary {
  email: string | null;
  phone: string | null;
  gender: Gender | null;
  documentNumberMasked: string | null;
  documentNeedsReview: boolean;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianAcknowledgedAt: string | null;
  notes: string | null;
  user: { id: string; name: string; email: string } | null;
  memberships: Membership[];
  createdAt: string;
  updatedAt: string;
}

export interface Tryout {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  location: string | null;
  team: { id: string; name: string; type: string } | null;
  startsAt: string | null;
  registrationStartsAt: string | null;
  registrationEndsAt: string | null;
  maxSlots: number | null;
  usedSlots: number;
  status: TryoutStatus;
  acceptingRegistrations: boolean;
  blockReason: string | null;
  cancellationReason: string | null;
}

export interface TryoutRegistration {
  id: string;
  tryout: { id: string; title: string; slug: string };
  fullName: string;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  gender: Gender | null;
  desiredPosition: string | null;
  experience: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  status: RegistrationStatus;
  reviewReason: string | null;
  reviewedAt: string | null;
  athleteId: string | null;
  createdAt: string;
}

export interface Interested {
  id: string;
  fullName: string;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  desiredPosition: string | null;
  notes: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  status: InterestedStatus;
  convertedAthleteId: string | null;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface DashboardIndicator {
  key: string;
  label: string;
  value: string;
  definition: string;
  link: string;
}

export const ATHLETE_STATUS: Record<AthleteStatus, { label: string; badge: string }> = {
  PENDING: { label: 'Pendente', badge: 'badge-warning' },
  ACTIVE: { label: 'Ativo', badge: 'badge-success' },
  INACTIVE: { label: 'Inativo', badge: '' },
  SUSPENDED: { label: 'Suspenso', badge: 'badge-danger' }
};

export const ATHLETE_NEXT: Record<AthleteStatus, AthleteStatus[]> = {
  PENDING: ['ACTIVE', 'INACTIVE'],
  ACTIVE: ['INACTIVE', 'SUSPENDED'],
  SUSPENDED: ['ACTIVE', 'INACTIVE'],
  INACTIVE: ['ACTIVE']
};

export const TEAM_TYPE: Record<TeamType, string> = {
  MALE: 'Masculino',
  FEMALE: 'Feminino',
  MIXED: 'Misto',
  OTHER: 'Outro'
};

export const GENDER: Record<Gender, string> = {
  FEMALE: 'Feminino',
  MALE: 'Masculino',
  NON_BINARY: 'Não binário',
  OTHER: 'Outro',
  NOT_INFORMED: 'Prefiro não informar'
};

export const TRYOUT_STATUS: Record<TryoutStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Rascunho', badge: '' },
  SCHEDULED: { label: 'Agendada', badge: 'badge-info' },
  OPEN: { label: 'Inscrições abertas', badge: 'badge-success' },
  CLOSED: { label: 'Inscrições encerradas', badge: 'badge-warning' },
  COMPLETED: { label: 'Concluída', badge: '' },
  CANCELLED: { label: 'Cancelada', badge: 'badge-danger' }
};

export const TRYOUT_NEXT: Record<TryoutStatus, TryoutStatus[]> = {
  DRAFT: ['SCHEDULED', 'OPEN', 'CANCELLED'],
  SCHEDULED: ['OPEN', 'CANCELLED'],
  OPEN: ['CLOSED', 'CANCELLED'],
  CLOSED: ['OPEN', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

export const REGISTRATION_STATUS: Record<RegistrationStatus, { label: string; badge: string }> = {
  NEW: { label: 'Nova', badge: 'badge-info' },
  UNDER_REVIEW: { label: 'Em análise', badge: 'badge-warning' },
  APPROVED: { label: 'Aprovada', badge: 'badge-success' },
  REJECTED: { label: 'Recusada', badge: 'badge-danger' },
  ATTENDED: { label: 'Compareceu', badge: 'badge-success' },
  NO_SHOW: { label: 'Não compareceu', badge: '' },
  CANCELLED: { label: 'Cancelada', badge: '' }
};

export const REGISTRATION_NEXT: Record<RegistrationStatus, RegistrationStatus[]> = {
  NEW: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['ATTENDED', 'NO_SHOW', 'CANCELLED'],
  REJECTED: ['UNDER_REVIEW'],
  NO_SHOW: ['ATTENDED'],
  ATTENDED: [],
  CANCELLED: []
};

export const INTERESTED_STATUS: Record<InterestedStatus, { label: string; badge: string }> = {
  NEW: { label: 'Novo', badge: 'badge-info' },
  CONTACTED: { label: 'Contatado', badge: 'badge-warning' },
  QUALIFIED: { label: 'Qualificado', badge: 'badge-success' },
  CONVERTED: { label: 'Convertido', badge: 'badge-brand' },
  ARCHIVED: { label: 'Arquivado', badge: '' }
};

export const INTERESTED_NEXT: Record<InterestedStatus, InterestedStatus[]> = {
  NEW: ['CONTACTED', 'QUALIFIED', 'ARCHIVED'],
  CONTACTED: ['QUALIFIED', 'ARCHIVED'],
  QUALIFIED: ['CONTACTED', 'ARCHIVED'],
  ARCHIVED: ['CONTACTED'],
  CONVERTED: []
};

export const POSITIONS = [
  'Levantador(a)',
  'Oposto(a)',
  'Ponteiro(a)',
  'Central',
  'Líbero',
  'Ainda não sei'
];
