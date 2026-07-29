import {
  createNumericCode,
  createOpaqueSecret,
  hashSecret,
  normalizeEmail,
  safelyEqualHash
} from './security';

describe('security primitives', () => {
  it('normalizes account e-mails deterministically', () => {
    expect(normalizeEmail('  Pessoa@Example.TEST ')).toBe('pessoa@example.test');
  });

  it('creates recovery codes and opaque tokens without persisting the raw value', () => {
    const code = createNumericCode(6);
    const firstSecret = createOpaqueSecret();
    const secondSecret = createOpaqueSecret();

    expect(code).toMatch(/^\d{6}$/u);
    expect(firstSecret).not.toBe(secondSecret);
    expect(firstSecret.length).toBeGreaterThanOrEqual(40);
  });

  it('binds hashes to their context and compares them safely', () => {
    const firstHash = hashSecret('raw-secret', 'pepper', 'refresh:one');
    const repeatedHash = hashSecret('raw-secret', 'pepper', 'refresh:one');
    const otherContextHash = hashSecret('raw-secret', 'pepper', 'csrf:one');

    expect(firstHash).not.toContain('raw-secret');
    expect(safelyEqualHash(firstHash, repeatedHash)).toBe(true);
    expect(safelyEqualHash(firstHash, otherContextHash)).toBe(false);
  });
});
