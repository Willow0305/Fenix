import { UnauthorizedException } from '@nestjs/common';

import { AccessTokenService } from './access-token.service';
import { AuthConfig } from './auth.config';
import { PasswordHasherService } from './password-hasher.service';

describe('Phase 1 authentication cryptography', () => {
  const originalNodeEnv = process.env['NODE_ENV'];
  const originalCost = process.env['AUTH_BCRYPT_COST'];

  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
    process.env['AUTH_BCRYPT_COST'] = '10';
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = originalNodeEnv;
    }

    if (originalCost === undefined) {
      delete process.env['AUTH_BCRYPT_COST'];
    } else {
      process.env['AUTH_BCRYPT_COST'] = originalCost;
    }
  });

  it('stores passwords only as an adaptive bcrypt hash', async () => {
    const hasher = new PasswordHasherService(new AuthConfig());
    const passwordHash = await hasher.hash('senha-segura-123');

    expect(passwordHash).toMatch(/^\$2[aby]\$10\$/u);
    expect(passwordHash).not.toContain('senha-segura-123');
    await expect(hasher.verify('senha-segura-123', passwordHash)).resolves.toBe(true);
    await expect(hasher.verify('senha-incorreta', passwordHash)).resolves.toBe(false);
  });

  it('issues bounded signed access tokens and rejects tampering', () => {
    const tokens = new AccessTokenService(new AuthConfig());
    const token = tokens.issue(
      '3b9f7d4c-0b66-42ed-ad9b-c4d163bb7e82',
      'f55bff5e-8098-4ebd-8087-f707f1d9ee71'
    );
    const claims = tokens.verify(token);

    expect(claims.sub).toBe('3b9f7d4c-0b66-42ed-ad9b-c4d163bb7e82');
    expect(claims.sid).toBe('f55bff5e-8098-4ebd-8087-f707f1d9ee71');
    expect(() => tokens.verify(`${token.slice(0, -1)}x`)).toThrow(UnauthorizedException);
  });
});
