import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { AppError } from '../errors/app-error';
import type { ContextRequest } from './request-context';

const KEY_PATTERN = /^[A-Za-z0-9_:-]{8,120}$/;

/**
 * Exige o cabeçalho `Idempotency-Key` (10-API.md §2.3) em confirmações financeiras.
 * Reenvios com a mesma chave pelo mesmo autor devolvem o resultado original.
 */
export const IdempotencyKey = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const value = ctx.switchToHttp().getRequest<ContextRequest>().header('idempotency-key');

  if (value === undefined || !KEY_PATTERN.test(value)) {
    throw new AppError(
      'BAD_REQUEST',
      'IDEMPOTENCY_KEY_REQUIRED',
      'Envie o cabeçalho Idempotency-Key (8 a 120 caracteres: letras, números, "-", "_" ou ":").'
    );
  }

  return value;
});
