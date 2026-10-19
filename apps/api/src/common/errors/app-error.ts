export type AppErrorKind =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'VALIDATION'
  | 'TOO_MANY_REQUESTS';

export const APP_ERROR_STATUS: Record<AppErrorKind, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION: 422,
  TOO_MANY_REQUESTS: 429
};

export interface FieldError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

/**
 * Erro esperado de negócio ou de entrada. A mensagem é exibida ao cliente, portanto
 * nunca deve conter dados de outro titular, segredos ou detalhes internos.
 */
export class AppError extends Error {
  constructor(
    readonly kind: AppErrorKind,
    readonly code: string,
    message: string,
    readonly fieldErrors: readonly FieldError[] = []
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(message = 'Recurso não encontrado.'): AppError {
    return new AppError('NOT_FOUND', 'NOT_FOUND', message);
  }

  static forbidden(message = 'Você não tem permissão para esta ação.'): AppError {
    return new AppError('FORBIDDEN', 'FORBIDDEN', message);
  }

  static unauthorized(message = 'Autenticação necessária.'): AppError {
    return new AppError('UNAUTHORIZED', 'UNAUTHORIZED', message);
  }

  static conflict(code: string, message: string): AppError {
    return new AppError('CONFLICT', code, message);
  }

  static validation(
    code: string,
    message: string,
    fieldErrors: readonly FieldError[] = []
  ): AppError {
    return new AppError('VALIDATION', code, message, fieldErrors);
  }
}
