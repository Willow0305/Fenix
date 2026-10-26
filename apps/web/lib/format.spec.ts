import { formatDate, formatDateTime, formatMoney, formatMonth } from './format';

describe('formatação', () => {
  it('formata data civil sem deslocar o fuso', () => {
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
    expect(formatDate(null)).toBe('—');
  });

  it('formata instantes UTC no fuso do time', () => {
    // 03:00 UTC é 22:00 do dia anterior em America/Rio_Branco (UTC-5).
    expect(formatDateTime('2026-03-02T03:00:00Z')).toBe('01/03/2026, 22:00');
  });

  it('formata dinheiro com moeda explícita', () => {
    expect(formatMoney('89.9').replace(/\s/g, ' ')).toBe('R$ 89,90');
  });

  it('formata o mês de referência', () => {
    expect(formatMonth('2026-07-01')).toBe('07/2026');
  });
});
