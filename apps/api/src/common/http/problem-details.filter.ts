import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

import { APP_ERROR_STATUS, AppError, type FieldError } from '../errors/app-error';
import { type ContextRequest, getRequestContext } from './request-context';

interface ProblemBody {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  instance: string;
  requestId: string;
  errors?: readonly FieldError[];
}

const TITLES: Record<number, string> = {
  400: 'Requisição inválida',
  401: 'Não autenticado',
  403: 'Acesso negado',
  404: 'Não encontrado',
  409: 'Conflito',
  413: 'Arquivo muito grande',
  415: 'Tipo de mídia não suportado',
  422: 'Dados inválidos',
  429: 'Muitas requisições',
  500: 'Erro interno',
  503: 'Serviço indisponível'
};

function codeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 415:
      return 'UNSUPPORTED_MEDIA_TYPE';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}

/**
 * Converte qualquer erro em `application/problem+json` (DT-011) sem vazar stack, query
 * ou dados internos. Erros inesperados são registrados apenas com nome e requestId.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<ContextRequest>();
    const res = http.getResponse<Response>();
    const { requestId } = getRequestContext(req);
    const problem = this.toProblem(exception, req.originalUrl.split('?')[0] ?? '', requestId);

    if (problem.status >= 500) {
      const name = exception instanceof Error ? exception.name : 'UnknownError';
      this.logger.error(`Falha não tratada (${name}) requestId=${requestId}`);
    }

    res.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown, instance: string, requestId: string): ProblemBody {
    const base = (status: number, code: string, detail: string): ProblemBody => ({
      type: `https://fenix.example/problems/${code.toLowerCase().replaceAll('_', '-')}`,
      title: TITLES[status] ?? 'Erro',
      status,
      code,
      detail,
      instance,
      requestId
    });

    if (exception instanceof AppError) {
      const problem = base(APP_ERROR_STATUS[exception.kind], exception.code, exception.message);

      return exception.fieldErrors.length > 0
        ? { ...problem, errors: exception.fieldErrors }
        : problem;
    }

    if (exception instanceof ThrottlerException) {
      return base(429, 'TOO_MANY_REQUESTS', 'Muitas tentativas. Aguarde e tente novamente.');
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'object' && response !== null && 'message' in response
          ? (response as { message: unknown }).message
          : exception.message;
      const detail =
        status >= 500
          ? 'Não foi possível concluir a operação.'
          : typeof message === 'string'
            ? message
            : 'Requisição inválida.';

      return base(status, codeForStatus(status), detail);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return base(409, 'UNIQUE_CONSTRAINT', 'Já existe um registro com estes dados.');
      }

      if (exception.code === 'P2025') {
        return base(404, 'NOT_FOUND', 'Recurso não encontrado.');
      }

      if (exception.code === 'P2034') {
        return base(409, 'CONCURRENT_UPDATE', 'Houve uma alteração simultânea. Tente novamente.');
      }

      if (exception.code === 'P2003') {
        return base(409, 'REFERENCE_CONSTRAINT', 'O registro está vinculado a outros dados.');
      }
    }

    return base(500, 'INTERNAL_ERROR', 'Não foi possível concluir a operação.');
  }
}
