import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_POLICY_KEY = 'fenix:rate-limit-policy';

export type RateLimitPolicyName =
  | 'login'
  | 'passwordRecovery'
  | 'codeValidation'
  | 'emailVerificationResend'
  | 'mfaChallenge'
  | 'refresh'
  | 'adminSensitive';

export const RateLimited = (policy: RateLimitPolicyName): MethodDecorator & ClassDecorator =>
  SetMetadata(RATE_LIMIT_POLICY_KEY, policy);
