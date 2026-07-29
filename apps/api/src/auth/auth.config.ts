import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

function readInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const rawValue = process.env[name];
  const value = rawValue === undefined ? fallback : Number(rawValue);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} deve ser um inteiro entre ${minimum} e ${maximum}.`);
  }

  return value;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name];

  if (rawValue === undefined) {
    return fallback;
  }

  if (rawValue !== 'true' && rawValue !== 'false') {
    throw new Error(`${name} deve ser true ou false.`);
  }

  return rawValue === 'true';
}

function readSecret(name: string, testFallback: string): string {
  const value = process.env[name];

  if (value && value.length >= 32) {
    return value;
  }

  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(`${name} deve existir e possuir ao menos 32 caracteres em produção.`);
  }

  return testFallback;
}

function readEncryptionKey(name: string, developmentSeed: string): Buffer {
  const configured = process.env[name];

  if (configured) {
    const key = Buffer.from(configured, 'base64');

    if (key.length !== 32 || key.toString('base64') !== configured) {
      throw new Error(`${name} deve ser uma chave de 32 bytes codificada em base64 canônico.`);
    }

    return key;
  }

  if (process.env['NODE_ENV'] === 'production' || process.env['APP_ENV'] === 'staging') {
    throw new Error(`${name} é obrigatória em staging e produção.`);
  }

  return createHash('sha256').update(developmentSeed).digest();
}

function readCookieSecure(): boolean {
  const secure = readBoolean('AUTH_COOKIE_SECURE', process.env['NODE_ENV'] === 'production');

  if (process.env['NODE_ENV'] === 'production' && !secure) {
    throw new Error('AUTH_COOKIE_SECURE deve ser true em produção.');
  }

  return secure;
}

@Injectable()
export class AuthConfig {
  public readonly accessTokenMinutes = readInteger('AUTH_ACCESS_TOKEN_MINUTES', 45, 5, 60);
  public readonly bcryptCost = readInteger('AUTH_BCRYPT_COST', 12, 10, 15);
  public readonly cookieSecure = readCookieSecure();
  public readonly inactivityMinutes = readInteger('AUTH_INACTIVITY_MINUTES', 45, 5, 1440);
  public readonly sessionAbsoluteDays = readInteger('AUTH_SESSION_ABSOLUTE_DAYS', 30, 1, 30);
  public readonly loginFailureWindowMinutes = readInteger(
    'AUTH_LOGIN_FAILURE_WINDOW_MINUTES',
    15,
    1,
    60
  );
  public readonly loginBlockMinutes = readInteger('AUTH_LOGIN_BLOCK_MINUTES', 15, 1, 1440);
  public readonly maxLoginAttempts = readInteger('AUTH_MAX_LOGIN_ATTEMPTS', 5, 2, 20);
  public readonly maxRecoveryAttempts = readInteger('AUTH_MAX_RECOVERY_ATTEMPTS', 5, 2, 20);
  public readonly recoveryBlockMinutes = readInteger('AUTH_RECOVERY_BLOCK_MINUTES', 15, 1, 1440);
  public readonly recoveryCodeLength = readInteger('AUTH_RECOVERY_CODE_LENGTH', 6, 6, 8);
  public readonly recoveryCodeMinutes = readInteger('AUTH_RECOVERY_CODE_MINUTES', 10, 10, 10);
  public readonly emailVerificationHours = readInteger('AUTH_EMAIL_VERIFICATION_HOURS', 24, 1, 24);
  public readonly emailVerificationResendSeconds = readInteger(
    'AUTH_EMAIL_VERIFICATION_RESEND_SECONDS',
    60,
    30,
    3600
  );
  public readonly mfaChallengeMinutes = readInteger('AUTH_MFA_CHALLENGE_MINUTES', 5, 2, 10);
  public readonly mfaRecoveryCodeCount = readInteger('AUTH_MFA_RECOVERY_CODE_COUNT', 10, 8, 12);
  public readonly accessTokenSecret = readSecret(
    'AUTH_ACCESS_TOKEN_SECRET',
    'test-access-secret-not-for-production-000000000000'
  );
  public readonly tokenPepper = readSecret(
    'AUTH_TOKEN_PEPPER',
    'test-token-pepper-not-for-production-0000000000000'
  );
  public readonly mfaEncryptionKey = readEncryptionKey(
    'AUTH_MFA_ENCRYPTION_KEY',
    'fenix-development-mfa-key-never-use-in-production'
  );
  public readonly mfaKeyVersion = process.env['AUTH_MFA_KEY_VERSION'] ?? 'local-v1';

  public readonly accessCookieName = 'fenix_access';
  public readonly refreshCookieName = 'fenix_refresh';
  public readonly csrfCookieName = 'fenix_csrf';
}
