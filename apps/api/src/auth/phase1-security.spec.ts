import { ApplicationConfig } from '../config/application.config';
import { RateLimitConfig } from '../rate-limit/rate-limit.config';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { AuthConfig } from './auth.config';
import { MfaCryptoService } from './mfa-crypto.service';
import { TotpService } from './totp.service';

describe('Phase 1 canonical security controls', () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
    process.env['APP_ENV'] = 'test';
    delete process.env['REDIS_URL'];
    delete process.env['AUTH_INACTIVITY_MINUTES'];
    delete process.env['AUTH_SESSION_ABSOLUTE_DAYS'];
    delete process.env['AUTH_RECOVERY_CODE_MINUTES'];
    delete process.env['AUTH_EMAIL_VERIFICATION_HOURS'];
    delete process.env['AUTH_MFA_ENCRYPTION_KEY'];
    delete process.env['RATE_LIMIT_ADMIN_SENSITIVE_MAX'];
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it('uses the approved canonical durations and attempts', () => {
    const config = new AuthConfig();

    expect(config.inactivityMinutes).toBe(45);
    expect(config.sessionAbsoluteDays).toBe(30);
    expect(config.recoveryCodeMinutes).toBe(10);
    expect(config.maxRecoveryAttempts).toBe(5);
    expect(config.maxLoginAttempts).toBe(5);
    expect(config.loginFailureWindowMinutes).toBe(15);
    expect(config.loginBlockMinutes).toBe(15);
    expect(config.emailVerificationHours).toBe(24);
  });

  it('implements RFC 6238-compatible TOTP and rejects timestep replay', () => {
    const totp = new TotpService();
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    const instant = new Date(59_000);
    const code = totp.codeAt(secret, instant);
    const step = totp.verify(secret, code, instant);

    expect(code).toBe('287082');
    expect(step).toBe(1);
    expect(totp.verify(secret, code, instant, step)).toBeUndefined();
  });

  it('encrypts a TOTP secret with authenticated encryption and associated user identity', () => {
    const config = new AuthConfig();
    const crypto = new MfaCryptoService(config);
    const userId = '36a1e2a5-e926-4dcb-abd4-6e7ae82b2991';
    const secret = 'JBSWY3DPEHPK3PXP';
    const encrypted = crypto.encrypt(secret, userId);

    expect(encrypted.secretCiphertext).not.toContain(secret);
    expect(crypto.decrypt(encrypted, userId)).toBe(secret);
    expect(() => crypto.decrypt(encrypted, 'ca12db67-9065-4cbe-9a77-fec76490df37')).toThrow();
  });

  it('enforces the local fixed-window adapter when Redis is intentionally absent', async () => {
    process.env['RATE_LIMIT_LOGIN_MAX'] = '5';
    const service = new RateLimitService(new RateLimitConfig(), new ApplicationConfig());
    const results = [];

    for (let index = 0; index < 6; index += 1) {
      results.push(await service.consume('login', 'same-subject'));
    }

    expect(results.slice(0, 5).every(({ allowed }) => allowed)).toBe(true);
    expect(results[5]?.allowed).toBe(false);
  });

  it('rejects invalid rate-limit policies during application startup', () => {
    process.env['RATE_LIMIT_ADMIN_SENSITIVE_MAX'] = '501';

    expect(() => new RateLimitConfig()).toThrow('RATE_LIMIT_ADMIN_SENSITIVE_MAX');
  });

  it('refuses production without named responsibilities and release approval', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['APP_ENV'] = 'production';
    delete process.env['RESPONSIBLE_TECHNOLOGY'];
    delete process.env['PRODUCTION_RELEASE_APPROVED'];

    expect(() => new ApplicationConfig()).toThrow('RESPONSIBLE_TECHNOLOGY');
  });

  it('rejects attempts to enable health data collection', () => {
    process.env['HEALTH_DATA_COLLECTION_ENABLED'] = 'true';

    expect(() => new ApplicationConfig()).toThrow('dados de saúde');
  });
});
