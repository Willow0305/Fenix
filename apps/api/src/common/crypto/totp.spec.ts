import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  totpCode,
  totpStep,
  totpUri,
  verifyTotp
} from './totp';

// Segredo ASCII "12345678901234567890" dos vetores de teste da RFC 6238 (apêndice B).
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('totp', () => {
  it('round-trips base32', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);

    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
  });

  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1234567890, '89005924'],
    [2000000000, '69279037']
  ])('matches the RFC 6238 SHA-1 vector at T=%d', (seconds, expected) => {
    expect(totpCode(RFC_SECRET, totpStep(new Date(seconds * 1000)), 8)).toBe(expected);
  });

  it('accepts the current code and one step of clock drift', () => {
    const secret = generateTotpSecret();
    const now = new Date('2026-10-25T18:00:00Z');
    const step = totpStep(now);

    expect(verifyTotp(secret, totpCode(secret, step), now, null)).toBe(step);
    expect(verifyTotp(secret, totpCode(secret, step - 1), now, null)).toBe(step - 1);
    expect(verifyTotp(secret, totpCode(secret, step + 1), now, null)).toBe(step + 1);
    expect(verifyTotp(secret, totpCode(secret, step - 2), now, null)).toBeNull();
  });

  it('rejects a code that was already used (replay)', () => {
    const secret = generateTotpSecret();
    const now = new Date('2026-10-25T18:00:00Z');
    const step = totpStep(now);

    expect(verifyTotp(secret, totpCode(secret, step), now, step)).toBeNull();
    expect(verifyTotp(secret, totpCode(secret, step - 1), now, step)).toBeNull();
  });

  it('rejects malformed codes', () => {
    const secret = generateTotpSecret();
    const now = new Date();

    expect(verifyTotp(secret, '12345', now, null)).toBeNull();
    expect(verifyTotp(secret, 'abcdef', now, null)).toBeNull();
  });

  it('builds an otpauth URI with issuer and account', () => {
    expect(totpUri('ABC', 'ana@exemplo.com', 'Fênix Vôlei')).toBe(
      'otpauth://totp/F%C3%AAnix%20V%C3%B4lei%3Aana%40exemplo.com?secret=ABC&issuer=F%C3%AAnix+V%C3%B4lei&algorithm=SHA1&digits=6&period=30'
    );
  });
});
