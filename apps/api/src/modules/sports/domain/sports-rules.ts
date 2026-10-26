import type {
  AthleteStatus,
  InterestedPersonStatus,
  TryoutRegistrationStatus,
  TryoutStatus
} from '../../../generated/prisma/client';

import { ageOn } from '../../../common/domain/civil-date';
import type { TransitionTable } from '../../../common/domain/state-machine';
import type { FieldError } from '../../../common/errors/app-error';

/** Regras puras do domínio esportivo (RN-ATL-*, DT-026, DT-028). */

export const PRIVACY_NOTICE_VERSION = '2026-10';
export const ADULT_AGE = 18;
export const GUARDIAN_ACK_AGE = 12;

export interface GuardianInput {
  readonly birthDate: string | null;
  readonly guardianName: string | null;
  readonly guardianPhone: string | null;
  readonly guardianAcknowledged?: boolean;
}

export type GuardianContext = 'admin' | 'public';

/**
 * Menor de 18 exige nome e telefone do responsável. Menor de 12 exige ainda a ciência
 * do responsável e só pode ser cadastrado pela diretoria (DT-026).
 */
export function validateGuardian(
  input: GuardianInput,
  today: string,
  context: GuardianContext
): FieldError[] {
  if (input.birthDate === null) {
    return [];
  }

  const age = ageOn(input.birthDate, today);
  const errors: FieldError[] = [];

  if (age < 0 || age > 100) {
    errors.push({
      field: 'birthDate',
      code: 'INVALID_BIRTH_DATE',
      message: 'Data de nascimento inválida.'
    });

    return errors;
  }

  if (age < ADULT_AGE) {
    if (!input.guardianName?.trim()) {
      errors.push({
        field: 'guardianName',
        code: 'GUARDIAN_REQUIRED',
        message: 'Informe o nome do responsável.'
      });
    }

    if (!input.guardianPhone?.trim()) {
      errors.push({
        field: 'guardianPhone',
        code: 'GUARDIAN_REQUIRED',
        message: 'Informe o telefone do responsável.'
      });
    }
  }

  if (age < GUARDIAN_ACK_AGE) {
    if (context === 'public') {
      errors.push({
        field: 'birthDate',
        code: 'UNDER_MINIMUM_AGE',
        message:
          'Inscrições de menores de 12 anos são feitas pelo responsável junto à diretoria do time.'
      });
    } else if (!input.guardianAcknowledged) {
      errors.push({
        field: 'guardianAcknowledged',
        code: 'GUARDIAN_ACK_REQUIRED',
        message: 'Confirme a ciência do responsável para cadastrar menor de 12 anos.'
      });
    }
  }

  return errors;
}

export const ATHLETE_STATUS_LABELS: Record<AthleteStatus, string> = {
  PENDING: 'Pendente',
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  SUSPENDED: 'Suspenso'
};

export const ATHLETE_TRANSITIONS: TransitionTable<AthleteStatus> = {
  PENDING: ['ACTIVE', 'INACTIVE'],
  ACTIVE: ['INACTIVE', 'SUSPENDED'],
  SUSPENDED: ['ACTIVE', 'INACTIVE'],
  INACTIVE: ['ACTIVE']
};

export const TRYOUT_STATUS_LABELS: Record<TryoutStatus, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendada',
  OPEN: 'Inscrições abertas',
  CLOSED: 'Inscrições encerradas',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada'
};

export const TRYOUT_TRANSITIONS: TransitionTable<TryoutStatus> = {
  DRAFT: ['SCHEDULED', 'OPEN', 'CANCELLED'],
  SCHEDULED: ['OPEN', 'CANCELLED'],
  OPEN: ['CLOSED', 'CANCELLED'],
  CLOSED: ['OPEN', 'COMPLETED', 'CANCELLED']
};

export const TRYOUT_REGISTRATION_LABELS: Record<TryoutRegistrationStatus, string> = {
  NEW: 'Nova',
  UNDER_REVIEW: 'Em análise',
  APPROVED: 'Aprovada',
  REJECTED: 'Recusada',
  ATTENDED: 'Compareceu',
  NO_SHOW: 'Não compareceu',
  CANCELLED: 'Cancelada'
};

export const TRYOUT_REGISTRATION_TRANSITIONS: TransitionTable<TryoutRegistrationStatus> = {
  NEW: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['ATTENDED', 'NO_SHOW', 'CANCELLED'],
  REJECTED: ['UNDER_REVIEW'],
  NO_SHOW: ['ATTENDED']
};

/** Estados que exigem motivo registrado. */
export const REASON_REQUIRED_REGISTRATION: ReadonlySet<TryoutRegistrationStatus> = new Set([
  'REJECTED',
  'CANCELLED'
]);

/** Estados que ocupam vaga da seletiva. */
export const SLOT_CONSUMING: readonly TryoutRegistrationStatus[] = [
  'NEW',
  'UNDER_REVIEW',
  'APPROVED',
  'ATTENDED',
  'NO_SHOW'
];

export const INTERESTED_LABELS: Record<InterestedPersonStatus, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contatado',
  QUALIFIED: 'Qualificado',
  CONVERTED: 'Convertido em atleta',
  ARCHIVED: 'Arquivado'
};

/** CONVERTED só é alcançado pela ação de conversão, nunca por mudança manual. */
export const INTERESTED_TRANSITIONS: TransitionTable<InterestedPersonStatus> = {
  NEW: ['CONTACTED', 'QUALIFIED', 'ARCHIVED'],
  CONTACTED: ['QUALIFIED', 'ARCHIVED'],
  QUALIFIED: ['CONTACTED', 'ARCHIVED'],
  ARCHIVED: ['CONTACTED']
};

export interface TryoutWindow {
  readonly status: TryoutStatus;
  readonly registrationStartsAt: Date | null;
  readonly registrationEndsAt: Date | null;
  readonly maxSlots: number | null;
}

export type RegistrationBlock = 'NOT_OPEN' | 'NOT_STARTED' | 'ENDED' | 'FULL' | null;

/** RN-ATL-002: somente seletiva aberta, dentro do período e com vaga aceita inscrição. */
export function registrationBlock(
  tryout: TryoutWindow,
  usedSlots: number,
  now: Date
): RegistrationBlock {
  if (tryout.status !== 'OPEN') {
    return 'NOT_OPEN';
  }

  if (tryout.registrationStartsAt && now < tryout.registrationStartsAt) {
    return 'NOT_STARTED';
  }

  if (tryout.registrationEndsAt && now > tryout.registrationEndsAt) {
    return 'ENDED';
  }

  if (tryout.maxSlots !== null && usedSlots >= tryout.maxSlots) {
    return 'FULL';
  }

  return null;
}

export const REGISTRATION_BLOCK_MESSAGES: Record<Exclude<RegistrationBlock, null>, string> = {
  NOT_OPEN: 'Esta seletiva não está recebendo inscrições.',
  NOT_STARTED: 'As inscrições desta seletiva ainda não começaram.',
  ENDED: 'As inscrições desta seletiva foram encerradas.',
  FULL: 'Todas as vagas desta seletiva foram preenchidas.'
};

export interface MembershipPeriod {
  readonly startsOn: string;
  readonly endsOn: string | null;
}

/** Períodos fechados [início, fim]; fim nulo significa vínculo em aberto. */
export function periodsOverlap(a: MembershipPeriod, b: MembershipPeriod): boolean {
  const aEnd = a.endsOn ?? '9999-12-31';
  const bEnd = b.endsOn ?? '9999-12-31';

  return a.startsOn <= bEnd && b.startsOn <= aEnd;
}

export function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function slugify(value: string): string {
  return normalizeName(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Documento normalizado (somente dígitos/letras) para hash de duplicidade. */
export function normalizeDocument(value: string): string {
  return value.replace(/[^0-9a-z]/gi, '').toUpperCase();
}
