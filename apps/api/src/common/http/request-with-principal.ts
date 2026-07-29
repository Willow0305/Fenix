import type { Request } from 'express';

export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly sessionId: string;
  readonly name: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly mfaEnabled: boolean;
  readonly mfaVerified: boolean;
  readonly mfaEnrollmentRequired: boolean;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export interface RequestWithPrincipal extends Request {
  principal?: AuthenticatedPrincipal;
  requestId?: string;
}
