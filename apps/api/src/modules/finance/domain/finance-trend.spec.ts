import { money } from '../../../common/domain/money';
import { buildTrend, monthsBack, overdueRate } from './finance-trend';

describe('série do painel financeiro', () => {
  it('conta os meses para trás atravessando o ano', () => {
    expect(monthsBack('2026-02-15', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('inadimplência é o em aberto sobre o cobrado já vencido', () => {
    expect(overdueRate(money('400'), money('100'))).toBe('25.0');
    expect(overdueRate(money('300'), money('0'))).toBe('0.0');
    expect(overdueRate(money('0'), money('0'))).toBeNull();
  });

  it('mês sem movimento vale zero e sem taxa', () => {
    const [empty, filled] = buildTrend(
      ['2026-09', '2026-10'],
      [{ month: '2026-10', amount: '150.0000' }],
      [{ month: '2026-10', amount: '40.5000' }],
      [{ month: '2026-10', billedDue: '200.0000', overdue: '50.0000' }]
    );

    expect(empty).toMatchObject({ month: '2026-09', overdueRate: null });
    expect(empty?.income.toFixed(2)).toBe('0.00');
    expect(filled?.income.toFixed(2)).toBe('150.00');
    expect(filled?.expense.toFixed(2)).toBe('40.50');
    expect(filled?.overdueRate).toBe('25.0');
  });
});
