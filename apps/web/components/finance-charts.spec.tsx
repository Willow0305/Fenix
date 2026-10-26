import { fireEvent, render, screen } from '@testing-library/react';

import { axisTicks, compactMoney, IncomeExpenseChart, shortMonth } from './finance-charts';

describe('gráficos do painel financeiro', () => {
  it('marca o eixo em passos redondos acima do maior valor', () => {
    expect(axisTicks(4200)).toEqual([0, 2000, 4000, 6000]);
    expect(axisTicks(22, 3)).toEqual([0, 10, 20, 30]);
    // Clube sem movimento: escala mínima, nunca "R$ 0" repetido.
    expect(axisTicks(0, 4, 1000)).toEqual([0, 250, 500, 750, 1000]);
  });

  it('abrevia valores e meses em português', () => {
    expect(compactMoney(4000)).toBe('R$ 4 mil');
    expect(compactMoney(2_500_000)).toBe('R$ 2,5 mi');
    expect(shortMonth('2026-10')).toBe('out');
    expect(shortMonth('2027-01')).toBe('jan/27');
    expect(shortMonth('2026-03', true)).toBe('mar/26');
  });

  it('mostra os valores do mês ao focar pelo teclado', () => {
    render(<IncomeExpenseChart data={[{ month: '2026-10', income: 1500, expense: 40.5 }]} />);

    const month = screen.getByLabelText(/10\/2026: receita/);

    fireEvent.focus(month);
    expect(screen.getByRole('status')).toHaveTextContent('R$ 1.500,00');
    expect(screen.getByRole('status')).toHaveTextContent('R$ 40,50');
  });
});
