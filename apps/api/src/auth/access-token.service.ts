import { Injectable, UnauthorizedException } from '@nestjs/common';
import { sign, verify, type JwtPayload } from 'jsonwebtoken';

import { AuthConfig } from './auth.config';

interface AccessTokenClaims extends JwtPayload {
  readonly sub: string;
  readonly sid: string;
}

function isAccessTokenClaims(value: string | JwtPayload): value is AccessTokenClaims {
  return (
    typeof value === 'object' && typeof value.sub === 'string' && typeof value['sid'] === 'string'
  );
}

@Injectable()
export class AccessTokenService {
  public constructor(private readonly config: AuthConfig) {}

  public issue(userId: string, sessionId: string): string {
    return sign(
      {
        sid: sessionId
      },
      this.config.accessTokenSecret,
      {
        algorithm: 'HS256',
        audience: 'fenix-web',
        expiresIn: `${this.config.accessTokenMinutes}m`,
        issuer: 'fenix-api',
        subject: userId
      }
    );
  }

  public verify(token: string): AccessTokenClaims {
    try {
      const claims = verify(token, this.config.accessTokenSecret, {
        algorithms: ['HS256'],
        audience: 'fenix-web',
        issuer: 'fenix-api'
      });

      if (!isAccessTokenClaims(claims)) {
        throw new Error('Invalid claims.');
      }

      return claims;
    } catch {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Sua sessão não é válida ou expirou.'
      });
    }
  }
}
