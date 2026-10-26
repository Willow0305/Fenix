import { ValidationPipe, type ValidationError } from '@nestjs/common';

import { AppError, type FieldError } from '../errors/app-error';
import { translateValidationMessage } from './validation-messages';

function flatten(errors: readonly ValidationError[], prefix = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = prefix ? `${prefix}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([code, message]) => ({
      field,
      code,
      message: translateValidationMessage(code, message)
    }));

    return [...own, ...flatten(error.children ?? [], field)];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    whitelist: true,
    exceptionFactory: (errors) =>
      AppError.validation('VALIDATION_ERROR', 'Revise os campos informados.', flatten(errors))
  });
}
