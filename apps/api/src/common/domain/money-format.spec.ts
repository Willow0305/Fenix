import { formatBrl, money } from './money';

describe('formatBrl', () => {
  it('agrupa milhares e usa vírgula nos centavos, sem ponto flutuante', () => {
    expect(formatBrl('19086.8')).toBe('R$ 19.086,80');
    expect(formatBrl('1234567.05')).toBe('R$ 1.234.567,05');
    expect(formatBrl('0')).toBe('R$ 0,00');
    expect(formatBrl(money('999.999'))).toBe('R$ 1.000,00');
    expect(formatBrl('-1500.5')).toBe('-R$ 1.500,50');
  });
});
