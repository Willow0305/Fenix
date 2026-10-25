/**
 * Documentos e telefones brasileiros (docs/29 §3.2 e §3.3, DT-040). Funções puras usadas
 * pela API (validação de entrada) e pelo site (máscara e mensagem imediata). O valor
 * gravado é sempre só dígitos; a máscara existe apenas na exibição.
 */

export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, '');
}

function checkDigit(digits: string, weights: readonly number[]): number {
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  const rest = sum % 11;

  return rest < 2 ? 0 : 11 - rest;
}

/** CPF válido: 11 dígitos, dígitos verificadores corretos e não repetido (000…, 111…). */
export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);

  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const first = checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);

  return first === Number(digits[9]) && second === Number(digits[10]);
}

/** CNPJ válido: 14 dígitos, dígitos verificadores corretos e não repetido. */
export function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);

  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) {
    return false;
  }

  const first = checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return first === Number(digits[12]) && second === Number(digits[13]);
}

/** Máscara progressiva `000.000.000-00` (aceita digitação parcial). */
export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);

  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/** Máscara progressiva `00.000.000/0000-00`. */
export function formatCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14);

  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

/** CPF ou CNPJ conforme a quantidade de dígitos (parceiros e profissionais). */
export function isValidCpfOrCnpj(value: string): boolean {
  const digits = onlyDigits(value);

  return digits.length === 11 ? isValidCpf(digits) : isValidCnpj(digits);
}

export function formatCpfOrCnpj(value: string): string {
  return onlyDigits(value).length > 11 ? formatCnpj(value) : formatCpf(value);
}

/** DDDs válidos: 11 a 99, sem zero no segundo dígito (10, 20, 30… não existem). */
function validDdd(ddd: string): boolean {
  return /^[1-9][1-9]$/.test(ddd);
}

/** Celular: DDD + 9 dígitos começando por 9 (`(68) 99999-0000`). */
export function isValidMobilePhone(value: string): boolean {
  const digits = onlyDigits(value);

  return digits.length === 11 && validDdd(digits.slice(0, 2)) && digits[2] === '9';
}

/** Celular ou fixo (DDD + 8 dígitos começando por 2 a 5). Para parceiros e o time (PEN-057). */
export function isValidPhone(value: string): boolean {
  const digits = onlyDigits(value);

  if (digits.length === 10) {
    return validDdd(digits.slice(0, 2)) && /^[2-5]$/.test(digits[2] ?? '');
  }

  return isValidMobilePhone(digits);
}

/** Máscara progressiva `(00) 00000-0000` ou `(00) 0000-0000`. */
export function formatPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);

  if (d.length <= 2) {
    return d.length > 0 ? `(${d}` : '';
  }

  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  const split = rest.length > 8 ? 5 : 4;

  return rest.length > split
    ? `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`
    : `(${ddd}) ${rest}`;
}

/** Exibição de CPF guardado: oculta os 3 primeiros e os 2 últimos dígitos (LGPD). */
export function maskCpf(value: string): string {
  const d = onlyDigits(value);

  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : '***';
}

export const BR_MESSAGES = {
  cpf: 'CPF inválido. Confira os números.',
  cnpj: 'CNPJ inválido. Confira os números.',
  document: 'CPF ou CNPJ inválido. Confira os números.',
  mobile: 'Celular inválido. Use DDD + número, por exemplo (68) 99999-0000.',
  phone: 'Telefone inválido. Use DDD + número, por exemplo (68) 99999-0000 ou (68) 3222-0000.'
} as const;
