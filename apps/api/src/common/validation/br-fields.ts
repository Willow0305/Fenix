import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, ValidateBy } from 'class-validator';
import {
  BR_MESSAGES,
  isValidCpf,
  isValidCpfOrCnpj,
  isValidMobilePhone,
  isValidPhone,
  onlyDigits
} from '@fenix/validation';

/**
 * Campos brasileiros padronizados (docs/29 §3.2 e §3.3, DT-040). O valor chega com ou sem
 * máscara e é gravado só com dígitos. Use junto de `@IsOptional()` quando o campo não for
 * obrigatório; `allowEmpty` aceita string vazia nos PATCH em que ela significa "remover".
 */
interface BrFieldOptions {
  readonly allowEmpty?: boolean;
}

function brField(
  name: string,
  isValid: (value: string) => boolean,
  message: string,
  options: BrFieldOptions
): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? onlyDigits(value) : value
    ),
    IsString(),
    ValidateBy(
      {
        name,
        validator: {
          validate: (value: unknown) =>
            typeof value === 'string' &&
            ((options.allowEmpty === true && value === '') || isValid(value))
        }
      },
      { message }
    )
  );
}

/** Celular de pessoa física: `(00) 00000-0000`. */
export function IsMobilePhoneBr(options: BrFieldOptions = {}): PropertyDecorator {
  return brField('isMobilePhoneBr', isValidMobilePhone, BR_MESSAGES.mobile, options);
}

/** Celular ou fixo: parceiros, profissionais e contato do time (PEN-057). */
export function IsPhoneBr(options: BrFieldOptions = {}): PropertyDecorator {
  return brField('isPhoneBr', isValidPhone, BR_MESSAGES.phone, options);
}

/** CPF com dígitos verificadores; RG não é aceito (PEN-056). */
export function IsCpf(options: BrFieldOptions = {}): PropertyDecorator {
  return brField('isCpf', isValidCpf, BR_MESSAGES.cpf, options);
}

/** CPF ou CNPJ, para parceiros. */
export function IsCpfOrCnpj(options: BrFieldOptions = {}): PropertyDecorator {
  return brField('isCpfOrCnpj', isValidCpfOrCnpj, BR_MESSAGES.document, options);
}
