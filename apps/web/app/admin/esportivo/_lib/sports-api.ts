'use client';

import { ApiError, apiRequest } from '../../../lib/api-client';

export interface CollectionResponse<T> {
  readonly data: readonly T[];
  readonly pageInfo?: {
    readonly hasNextPage: boolean;
    readonly nextCursor?: string;
  };
}

export interface CategorySummary {
  readonly id: string;
  readonly name: string;
}

export interface TeamSummary {
  readonly id: string;
  readonly name: string;
}

export interface CategoryRecord extends CategorySummary {
  readonly kind: 'AGE_GROUP' | 'DIVISION' | 'GENDER' | 'LEVEL' | 'OTHER';
  readonly minimumAge: number | null;
  readonly maximumAge: number | null;
  readonly isActive: boolean;
  readonly teamsCount?: number;
}

export interface TeamRecord extends TeamSummary {
  readonly isActive: boolean;
  readonly categories: readonly CategorySummary[];
  readonly athletesCount?: number;
}

export interface AthleteMembershipSummary {
  readonly id: string;
  readonly team: TeamSummary;
  readonly category: CategorySummary;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly isCurrent: boolean;
}

export interface AthleteRecord {
  readonly id: string;
  readonly fullName: string;
  readonly birthDate: string;
  readonly status: string;
  readonly isMinor: boolean;
  readonly duplicateWarning: boolean;
  readonly guardianAuthorizationValid: boolean | null;
  readonly currentMembership: AthleteMembershipSummary | null;
}

export interface GuardianAthleteSummary {
  readonly athleteId: string;
  readonly athleteName: string;
  readonly authorizationValidUntil: string | null;
}

export interface GuardianRecord {
  readonly id: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly athletes: readonly GuardianAthleteSummary[];
}

export interface TryoutRecord {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly startsAt: string;
  readonly location: string | null;
  readonly capacity: number | null;
  readonly registrationsCount: number;
  readonly waitlistCount: number;
  readonly team: TeamSummary | null;
  readonly category: CategorySummary | null;
}

export interface RegistrationRecord {
  readonly id: string;
  readonly fullName: string;
  readonly birthDate: string;
  readonly status: string;
  readonly attendanceStatus: string | null;
  readonly result: string | null;
  readonly isMinor: boolean;
  readonly guardianAuthorizationValid: boolean | null;
  readonly duplicateWarning: boolean;
  readonly convertedAthleteId: string | null;
  readonly createdAt: string;
  readonly tryout: {
    readonly id: string;
    readonly title: string;
  };
}

export function listSportsRecords<T>(path: string): Promise<CollectionResponse<T>> {
  return apiRequest<CollectionResponse<T>>(`/sports${path}`);
}

export function createSportsRecord<T>(
  path: string,
  body: Readonly<Record<string, unknown>>
): Promise<T> {
  return apiRequest<T>(`/sports${path}`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function updateSportsRecord(
  path: string,
  body: Readonly<Record<string, unknown>>
): Promise<void> {
  return apiRequest<void>(`/sports${path}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}

export function formatCivilDate(value: string | null | undefined): string {
  if (!value) {
    return 'Não informado';
  }

  const [year, month, day] = value.slice(0, 10).split('-').map(Number);

  if (!year || !month || !day) {
    return 'Data inválida';
  }

  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}

export function formatInstant(value: string | null | undefined): string {
  if (!value) {
    return 'Não informado';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

const STATUS_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: 'Ativo',
  APPROVED: 'Aprovado',
  ATTENDED: 'Presente',
  CANCELLED: 'Cancelado',
  CLOSED: 'Encerrado',
  COMPLETED: 'Concluído',
  CONVERTED: 'Convertido',
  DRAFT: 'Rascunho',
  INACTIVE: 'Inativo',
  NEW: 'Nova',
  NO_SHOW: 'Ausente',
  OPEN: 'Aberta',
  PENDING: 'Pendente',
  REJECTED: 'Rejeitado',
  SCHEDULED: 'Agendado',
  UNDER_REVIEW: 'Em análise',
  WAITLISTED: 'Lista de espera'
};

export function translateStatus(value: string | null | undefined): string {
  if (!value) {
    return 'Não informado';
  }

  return STATUS_LABELS[value] ?? value;
}

export function getRequestErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
