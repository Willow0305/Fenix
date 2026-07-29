export const TRYOUT_REGISTRATION_STATUSES = [
  'NEW',
  'UNDER_REVIEW',
  'WAITLISTED',
  'APPROVED',
  'REJECTED',
  'ATTENDED',
  'NO_SHOW',
  'CONVERTED',
  'CANCELLED'
] as const;

export type TryoutRegistrationStatus = (typeof TRYOUT_REGISTRATION_STATUSES)[number];

const TRYOUT_REGISTRATION_TRANSITIONS = {
  NEW: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['WAITLISTED', 'APPROVED', 'REJECTED', 'CANCELLED'],
  WAITLISTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['ATTENDED', 'NO_SHOW', 'CONVERTED', 'CANCELLED'],
  REJECTED: [],
  ATTENDED: ['CONVERTED'],
  NO_SHOW: [],
  CONVERTED: [],
  CANCELLED: []
} as const satisfies Record<TryoutRegistrationStatus, readonly TryoutRegistrationStatus[]>;

export function listAllowedTryoutRegistrationTransitions(
  currentStatus: TryoutRegistrationStatus
): readonly TryoutRegistrationStatus[] {
  return TRYOUT_REGISTRATION_TRANSITIONS[currentStatus];
}

export function isTryoutRegistrationTransitionAllowed(
  currentStatus: TryoutRegistrationStatus,
  targetStatus: TryoutRegistrationStatus
): boolean {
  const allowedTransitions: readonly TryoutRegistrationStatus[] =
    TRYOUT_REGISTRATION_TRANSITIONS[currentStatus];

  return allowedTransitions.includes(targetStatus);
}
