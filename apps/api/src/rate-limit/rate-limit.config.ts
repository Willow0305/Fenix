import { Injectable } from '@nestjs/common';

import type { RateLimitPolicyName } from './rate-limit.decorator';

interface RateLimitPolicy {
  readonly limit: number;
  readonly windowSeconds: number;
}

function readInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} deve ser um inteiro entre ${minimum} e ${maximum}.`);
  }

  return value;
}

@Injectable()
export class RateLimitConfig {
  public readonly redisUrl = process.env['REDIS_URL'];
  private readonly policies: Readonly<Record<RateLimitPolicyName, RateLimitPolicy>>;

  public constructor() {
    this.policies = {
      login: {
        limit: readInteger('RATE_LIMIT_LOGIN_MAX', 10, 5, 100),
        windowSeconds: 15 * 60
      },
      passwordRecovery: {
        limit: readInteger('RATE_LIMIT_RECOVERY_MAX', 5, 2, 50),
        windowSeconds: 15 * 60
      },
      codeValidation: {
        limit: readInteger('RATE_LIMIT_CODE_VALIDATION_MAX', 10, 5, 100),
        windowSeconds: 15 * 60
      },
      emailVerificationResend: {
        limit: readInteger('RATE_LIMIT_EMAIL_RESEND_MAX', 5, 2, 50),
        windowSeconds: 15 * 60
      },
      mfaChallenge: {
        limit: readInteger('RATE_LIMIT_MFA_MAX', 10, 5, 100),
        windowSeconds: 15 * 60
      },
      refresh: {
        limit: readInteger('RATE_LIMIT_REFRESH_MAX', 30, 10, 300),
        windowSeconds: 15 * 60
      },
      adminSensitive: {
        limit: readInteger('RATE_LIMIT_ADMIN_SENSITIVE_MAX', 60, 10, 500),
        windowSeconds: 15 * 60
      }
    };
  }

  public policy(name: RateLimitPolicyName): RateLimitPolicy {
    return this.policies[name];
  }
}
