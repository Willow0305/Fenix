import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * JWT HS256 mínimo para o access token (DT-022). Somente o algoritmo HS256 é aceito;
 * o cabeçalho é comparado integralmente para impedir `alg: none` ou troca de algoritmo.
 */
export interface AccessTokenClaims {
  readonly sub: string;
  readonly sid: string;
  readonly iat: number;
  readonly exp: number;
}

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

function sign(input: string, secret: string): string {
  return createHmac('sha256', secret).update(input).digest('base64url');
}

export function signAccessToken(
  claims: { sub: string; sid: string },
  secret: string,
  ttlSeconds: number,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): string {
  const payload: AccessTokenClaims = {
    sub: claims.sub,
    sid: claims.sid,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const input = `${HEADER}.${body}`;

  return `${input}.${sign(input, secret)}`;
}

function isClaims(value: unknown): value is AccessTokenClaims {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record['sub'] === 'string' &&
    typeof record['sid'] === 'string' &&
    typeof record['iat'] === 'number' &&
    typeof record['exp'] === 'number'
  );
}

/** Retorna as claims se o token for íntegro e não expirado; caso contrário `null`. */
export function verifyAccessToken(
  token: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): AccessTokenClaims | null {
  const parts = token.split('.');

  if (parts.length !== 3 || parts[0] !== HEADER) {
    return null;
  }

  const [header, body, signature] = parts as [string, string, string];
  const expected = Buffer.from(sign(`${header}.${body}`, secret));
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!isClaims(parsed) || parsed.exp <= nowSeconds) {
    return null;
  }

  return parsed;
}
