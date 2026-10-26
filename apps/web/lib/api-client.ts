import type { Problem } from './api-types';
import { clientId } from './realtime';

/** Erro de API com Problem Details já interpretado. */
export class ApiError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.detail);
    this.name = 'ApiError';
  }

  get status(): number {
    return this.problem.status;
  }

  fieldError(field: string): string | undefined {
    return this.problem.errors?.find((error) => error.field === field)?.message;
  }
}

function isProblem(value: unknown): value is Problem {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['status'] === 'number' &&
    typeof (value as Record<string, unknown>)['detail'] === 'string'
  );
}

export async function parseProblem(response: Response): Promise<ApiError> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return new ApiError(
    isProblem(body)
      ? body
      : {
          status: response.status,
          code: 'HTTP_ERROR',
          title: 'Erro',
          detail:
            response.status >= 500
              ? 'O serviço está indisponível no momento. Tente novamente.'
              : 'Não foi possível concluir a operação.'
        }
  );
}

type TokenProvider = {
  getToken: () => string | null;
  refresh: () => Promise<string | null>;
};

let tokenProvider: TokenProvider = { getToken: () => null, refresh: async () => null };

/** Registrado pelo AuthProvider; mantém o access token apenas em memória (DT-022). */
export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

export interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  readonly query?: Record<string, string | number | boolean | undefined | null>;
  readonly headers?: Record<string, string>;
  readonly auth?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }

  const qs = params.toString();

  return `/api/v1${path}${qs ? `?${qs}` : ''}`;
}

async function send(
  path: string,
  options: RequestOptions,
  token: string | null
): Promise<Response> {
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };

  if (options.body !== undefined && !isForm) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Identifica esta aba nos avisos em tempo real, para ela não recarregar à toa (DT-049).
  if (typeof window !== 'undefined') {
    headers['X-Client-Id'] = clientId();
  }

  return fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    credentials: 'same-origin',
    body:
      options.body === undefined
        ? null
        : isForm
          ? (options.body as FormData)
          : JSON.stringify(options.body)
  });
}

/** Chamada à API no navegador; renova a sessão uma vez em caso de 401. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth !== false;
  let response = await send(path, options, useAuth ? tokenProvider.getToken() : null);

  if (response.status === 401 && useAuth) {
    const renewed = await tokenProvider.refresh();

    if (renewed) {
      response = await send(path, options, renewed);
    }
  }

  if (!response.ok) {
    throw await parseProblem(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Download autenticado de arquivo (comprovantes, relatórios). */
export async function apiBlob(path: string, query?: RequestOptions['query']): Promise<Blob> {
  let response = await send(path, { query: query ?? {} }, tokenProvider.getToken());

  if (response.status === 401) {
    const renewed = await tokenProvider.refresh();

    if (renewed) {
      response = await send(path, { query: query ?? {} }, renewed);
    }
  }

  if (!response.ok) {
    throw await parseProblem(response);
  }

  return response.blob();
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem.detail;
  }

  return 'Não foi possível concluir a operação. Verifique sua conexão e tente novamente.';
}
