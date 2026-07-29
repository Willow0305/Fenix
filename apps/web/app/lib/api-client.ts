'use client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3333';
const CSRF_COOKIE_NAME = 'fenix_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface ProblemDetails {
  readonly code?: string;
  readonly detail?: string;
  readonly status: number;
  readonly title?: string;
}

export class ApiError extends Error {
  public constructor(public readonly problem: ProblemDetails) {
    super(problem.detail ?? 'Não foi possível concluir a solicitação.');
    this.name = 'ApiError';
  }
}

function readCsrfCookie(): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const value = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CSRF_COOKIE_NAME}=`))
    ?.slice(CSRF_COOKIE_NAME.length + 1);

  return value ? decodeURIComponent(value) : undefined;
}

async function parseError(response: Response): Promise<ProblemDetails> {
  try {
    const value: unknown = await response.json();

    if (typeof value === 'object' && value !== null) {
      const record = value as Readonly<Record<string, unknown>>;

      return {
        status: response.status,
        ...(typeof record['code'] === 'string' ? { code: record['code'] } : {}),
        ...(typeof record['detail'] === 'string' ? { detail: record['detail'] } : {}),
        ...(typeof record['title'] === 'string' ? { title: record['title'] } : {})
      };
    }
  } catch {
    // A resposta pode não possuir corpo JSON.
  }

  return {
    status: response.status,
    detail: 'Não foi possível concluir a solicitação.'
  };
}

async function execute(path: string, init: RequestInit): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  const csrfToken = readCsrfCookie();

  if (init.body && !headers.has('content-type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!SAFE_METHODS.has(method) && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  return fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers
  });
}

async function refreshSession(): Promise<boolean> {
  const response = await execute('/auth/refresh', {
    method: 'POST'
  });

  return response.ok;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retryAfterRefresh = true
): Promise<T> {
  let response = await execute(path, init);

  if (
    response.status === 401 &&
    retryAfterRefresh &&
    path !== '/auth/login' &&
    path !== '/auth/refresh'
  ) {
    if (await refreshSession()) {
      response = await execute(path, init);
    } else if (typeof window !== 'undefined') {
      window.location.assign('/sessao-expirada');
    }
  }

  if (!response.ok) {
    throw new ApiError(await parseError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface SessionUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly mfaEnabled: boolean;
  readonly mfaVerified: boolean;
  readonly mfaEnrollmentRequired: boolean;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export interface SessionResponse {
  readonly status: 'SESSION_CREATED';
  readonly user: SessionUser;
  readonly accessExpiresAt?: string;
  readonly sessionExpiresAt?: string;
}

export interface MfaRequiredResponse {
  readonly status: 'MFA_REQUIRED';
  readonly challengeToken: string;
  readonly expiresAt: string;
}

export type LoginResponse = SessionResponse | MfaRequiredResponse;
