import type { ArgumentsHost } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import type { RequestWithPrincipal } from './request-with-principal';

interface HttpExceptionPayload {
  readonly message?: string | readonly string[];
  readonly error?: string;
  readonly code?: string;
}

function isHttpExceptionPayload(value: unknown): value is HttpExceptionPayload {
  return typeof value === 'object' && value !== null;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithPrincipal>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : {};
    const payload = isHttpExceptionPayload(exceptionResponse) ? exceptionResponse : {};
    const defaultTitle = HttpStatus[status] ?? 'Erro';
    const messages = Array.isArray(payload.message) ? payload.message : undefined;
    const detail =
      status >= 500
        ? 'Não foi possível concluir a solicitação.'
        : typeof payload.message === 'string'
          ? payload.message
          : 'Revise os dados e tente novamente.';

    if (status >= 500) {
      const error =
        exception instanceof Error
          ? `${exception.name}: ${exception.message}\n${exception.stack ?? ''}`
          : 'Unhandled non-Error exception';

      this.logger.error(error);
    }

    response
      .status(status)
      .type('application/problem+json')
      .json({
        type: `https://fenix.local/problems/${payload.code ?? 'request-error'}`,
        title: payload.error ?? defaultTitle,
        status,
        code: payload.code ?? `HTTP_${status}`,
        detail,
        instance: request.originalUrl,
        requestId: request.requestId,
        ...(messages
          ? {
              errors: messages.map((message) => ({
                code: 'INVALID_VALUE',
                message
              }))
            }
          : {})
      });
  }
}
