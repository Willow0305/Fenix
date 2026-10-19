import { formatDate, formatDateTime, formatMoney, formatMonth } from './format';

describe('format', () => {
  it('formats a civil date without timezone shift', () => {
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
    expect(formatDate(null)).toBe('—');
  });

  it('formats UTC instants in the team time zone', () => {
    // 03:00 UTC é 22:00 do dia anterior em America/Rio_Branco (UTC-5).
    expect(formatDateTime('2026-03-02T03:00:00Z')).toBe('01/03/2026, 22:00');
  });

  it('formats money with explicit currency', () => {
    expect(formatMoney('89.9').replace(/\s/g, ' ')).toBe('R$ 89,90');
  });

  it('formats reference months', () => {
    expect(formatMonth('2026-07-01')).toBe('07/2026');
  });
});
