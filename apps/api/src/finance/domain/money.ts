const MONEY_SCALE = 10_000n;
const MONEY_PATTERN = /^(-)?(?:0|[1-9]\d*)(?:\.(\d{1,4}))?$/u;

export function parseMoneyToUnits(
  value: string,
  options?: { readonly allowNegative?: boolean; readonly allowZero?: boolean }
): bigint {
  const normalized = value.trim();
  const match = MONEY_PATTERN.exec(normalized);

  if (!match) {
    throw new RangeError('O valor monetário deve ser decimal, não negativo e ter até 4 casas.');
  }

  const unsigned = normalized.replace(/^-/, '');
  const whole = BigInt(unsigned.split('.')[0] ?? '0');
  const fraction = BigInt((match[2] ?? '').padEnd(4, '0') || '0');
  const absoluteUnits = whole * MONEY_SCALE + fraction;
  const units = match[1] ? -absoluteUnits : absoluteUnits;

  if (!options?.allowZero && units === 0n) {
    throw new RangeError('O valor monetário deve ser maior que zero.');
  }

  if (!options?.allowNegative && units < 0n) {
    throw new RangeError('O valor monetário não pode ser negativo.');
  }

  return units;
}

export function formatMoneyUnits(units: bigint): string {
  const sign = units < 0n ? '-' : '';
  const absolute = units < 0n ? -units : units;
  const whole = absolute / MONEY_SCALE;
  const fraction = (absolute % MONEY_SCALE).toString().padStart(4, '0');

  return `${sign}${whole.toString()}.${fraction}`;
}
