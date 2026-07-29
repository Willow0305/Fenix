import { isMinorOnCivilDate } from './civil-date';

export const MINOR_PROTECTION_REQUIREMENTS = {
  guardianLink: 'GUARDIAN_LINK',
  validGuardianAuthorization: 'VALID_GUARDIAN_AUTHORIZATION'
} as const;

export type MinorProtectionRequirement =
  (typeof MINOR_PROTECTION_REQUIREMENTS)[keyof typeof MINOR_PROTECTION_REQUIREMENTS];

export interface AthleteProtectionInput {
  readonly birthDate: string;
  readonly referenceDate: string;
  readonly hasGuardianLink: boolean;
  readonly hasValidGuardianAuthorization: boolean;
}

export interface AthleteProtectionDecision {
  readonly allowed: boolean;
  readonly isMinor: boolean;
  readonly missingRequirements: readonly MinorProtectionRequirement[];
}

export function evaluateAthleteProtection(
  input: AthleteProtectionInput
): AthleteProtectionDecision {
  const isMinor = isMinorOnCivilDate(input.birthDate, input.referenceDate);

  if (!isMinor) {
    return {
      allowed: true,
      isMinor: false,
      missingRequirements: []
    };
  }

  const missingRequirements: MinorProtectionRequirement[] = [];

  if (!input.hasGuardianLink) {
    missingRequirements.push(MINOR_PROTECTION_REQUIREMENTS.guardianLink);
  }

  if (!input.hasValidGuardianAuthorization) {
    missingRequirements.push(MINOR_PROTECTION_REQUIREMENTS.validGuardianAuthorization);
  }

  return {
    allowed: missingRequirements.length === 0,
    isMinor: true,
    missingRequirements
  };
}
