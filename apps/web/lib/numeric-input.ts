/**
 * Campos numéricos (DT-051): só aceitam o que um número pode ter, inclusive ao colar.
 * Valores em reais aparecem com vírgula para a pessoa e seguem com ponto para a API
 * (`89,90` na tela, `89.90` no envio).
 */
export type NumericMode = 'integer' | 'decimal';

export function digitsOnly(value: string, maxLength = 9): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

/** Número com até 2 casas, no formato da API (ponto), a partir do que foi digitado. */
export function decimalInput(value: string): string {
  // Com vírgula, ela é o decimal e os pontos são milhar ("1.234,50"); sem vírgula, o
  // ponto é o decimal ("89.90").
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.').replace(/,/g, '')
    : value;
  const cleaned = normalized.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  const integer = whole.slice(0, 13);

  return rest.length === 0 ? integer : `${integer}.${rest.join('').slice(0, 2)}`;
}

/** Como o valor aparece no campo: vírgula no lugar do ponto. */
export function decimalDisplay(value: string): string {
  return value.replace('.', ',');
}

export function sanitizeNumeric(mode: NumericMode, value: string): string {
  return mode === 'integer' ? digitsOnly(value) : decimalInput(value);
}
