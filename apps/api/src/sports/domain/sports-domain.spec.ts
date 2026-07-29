import {
  MINOR_PROTECTION_REQUIREMENTS,
  calculateAgeOnCivilDate,
  createAthleteDuplicateFingerprint,
  evaluateAthleteProtection,
  isMinorOnCivilDate,
  isTryoutRegistrationTransitionAllowed,
  listAllowedTryoutRegistrationTransitions,
  parseCivilDate,
  TRYOUT_REGISTRATION_STATUSES,
  type TryoutRegistrationStatus
} from '.';

const TEST_HMAC_KEY = 'test-only-athlete-fingerprint-key-0000000000000001';

describe('sports domain civil dates', () => {
  it('calculates age deterministically around the eighteenth birthday', () => {
    expect(calculateAgeOnCivilDate('2008-07-28', '2026-07-27')).toBe(17);
    expect(isMinorOnCivilDate('2008-07-28', '2026-07-27')).toBe(true);
    expect(calculateAgeOnCivilDate('2008-07-27', '2026-07-27')).toBe(18);
    expect(isMinorOnCivilDate('2008-07-27', '2026-07-27')).toBe(false);
  });

  it('treats a leap-day birthday using only the explicit civil dates', () => {
    expect(calculateAgeOnCivilDate('2008-02-29', '2026-02-28')).toBe(17);
    expect(calculateAgeOnCivilDate('2008-02-29', '2026-03-01')).toBe(18);
  });

  it('rejects invalid or chronologically inconsistent civil dates', () => {
    expect(() => parseCivilDate('2026-02-29')).toThrow(RangeError);
    expect(() => parseCivilDate('27/07/2026')).toThrow(RangeError);
    expect(() => calculateAgeOnCivilDate('2026-07-28', '2026-07-27')).toThrow(RangeError);
  });
});

describe('sports domain minor protection', () => {
  it('does not require a guardian workflow for an adult', () => {
    expect(
      evaluateAthleteProtection({
        birthDate: '2000-01-01',
        referenceDate: '2026-07-27',
        hasGuardianLink: false,
        hasValidGuardianAuthorization: false
      })
    ).toEqual({
      allowed: true,
      isMinor: false,
      missingRequirements: []
    });
  });

  it('allows a minor only with both the guardian link and valid authorization', () => {
    expect(
      evaluateAthleteProtection({
        birthDate: '2010-01-01',
        referenceDate: '2026-07-27',
        hasGuardianLink: true,
        hasValidGuardianAuthorization: true
      })
    ).toEqual({
      allowed: true,
      isMinor: true,
      missingRequirements: []
    });
  });

  it('reports every missing protection requirement without accepting the minor', () => {
    expect(
      evaluateAthleteProtection({
        birthDate: '2010-01-01',
        referenceDate: '2026-07-27',
        hasGuardianLink: false,
        hasValidGuardianAuthorization: false
      })
    ).toEqual({
      allowed: false,
      isMinor: true,
      missingRequirements: [
        MINOR_PROTECTION_REQUIREMENTS.guardianLink,
        MINOR_PROTECTION_REQUIREMENTS.validGuardianAuthorization
      ]
    });
  });
});

describe('sports domain duplicate fingerprint', () => {
  it('produces the same HMAC for equivalent normalized names', () => {
    const first = createAthleteDuplicateFingerprint(
      {
        fullName: '  ÁLVARO   da   Conceição ',
        birthDate: '2001-04-09'
      },
      TEST_HMAC_KEY
    );
    const repeated = createAthleteDuplicateFingerprint(
      {
        fullName: 'alvaro da conceicao',
        birthDate: '2001-04-09'
      },
      TEST_HMAC_KEY
    );

    expect(first).toBe(repeated);
    expect(first).toMatch(/^v1\.[a-f0-9]{64}$/u);
    expect(first).not.toContain('alvaro');
    expect(first).not.toContain('2001');
  });

  it('separates people when a duplicate-comparison input differs', () => {
    const baseline = createAthleteDuplicateFingerprint(
      {
        fullName: 'Pessoa Fictícia',
        birthDate: '2001-04-09'
      },
      TEST_HMAC_KEY
    );
    const otherDate = createAthleteDuplicateFingerprint(
      {
        fullName: 'Pessoa Fictícia',
        birthDate: '2001-04-10'
      },
      TEST_HMAC_KEY
    );
    const otherName = createAthleteDuplicateFingerprint(
      {
        fullName: 'Outra Pessoa Fictícia',
        birthDate: '2001-04-09'
      },
      TEST_HMAC_KEY
    );

    expect(otherDate).not.toBe(baseline);
    expect(otherName).not.toBe(baseline);
  });

  it('rejects an empty name or a weak HMAC key', () => {
    expect(() =>
      createAthleteDuplicateFingerprint({ fullName: '   ', birthDate: '2001-04-09' }, TEST_HMAC_KEY)
    ).toThrow(RangeError);
    expect(() =>
      createAthleteDuplicateFingerprint(
        { fullName: 'Pessoa Fictícia', birthDate: '2001-04-09' },
        'short-key'
      )
    ).toThrow(RangeError);
  });
});

describe('sports domain tryout registration transitions', () => {
  const expectedTransitions: Readonly<
    Record<TryoutRegistrationStatus, readonly TryoutRegistrationStatus[]>
  > = {
    NEW: ['UNDER_REVIEW', 'CANCELLED'],
    UNDER_REVIEW: ['WAITLISTED', 'APPROVED', 'REJECTED', 'CANCELLED'],
    WAITLISTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['ATTENDED', 'NO_SHOW', 'CONVERTED', 'CANCELLED'],
    REJECTED: [],
    ATTENDED: ['CONVERTED'],
    NO_SHOW: [],
    CONVERTED: [],
    CANCELLED: []
  };

  it.each(TRYOUT_REGISTRATION_STATUSES)(
    'exposes only the explicitly approved transitions from %s',
    (currentStatus) => {
      expect(listAllowedTryoutRegistrationTransitions(currentStatus)).toEqual(
        expectedTransitions[currentStatus]
      );

      for (const targetStatus of TRYOUT_REGISTRATION_STATUSES) {
        expect(isTryoutRegistrationTransitionAllowed(currentStatus, targetStatus)).toBe(
          expectedTransitions[currentStatus].includes(targetStatus)
        );
      }
    }
  );

  it.each(['REJECTED', 'NO_SHOW', 'CONVERTED', 'CANCELLED'] as const)(
    'keeps %s terminal',
    (terminalStatus) => {
      expect(listAllowedTryoutRegistrationTransitions(terminalStatus)).toEqual([]);
    }
  );

  it('does not accept silent self-transitions', () => {
    for (const status of TRYOUT_REGISTRATION_STATUSES) {
      expect(isTryoutRegistrationTransitionAllowed(status, status)).toBe(false);
    }
  });
});
