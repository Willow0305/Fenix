import { columnTotals, periodLabel, reportDefinition, REPORTS } from './report-catalog';

describe('catálogo de relatórios', () => {
  it('descreve cada relatório com chave única', () => {
    const keys = REPORTS.map((r) => r.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(reportDefinition('cash')?.groupings?.length).toBe(4);
    expect(reportDefinition('nao-existe')).toBeUndefined();
  });

  it('totaliza colunas de números e dinheiro com exatidão', () => {
    const add = (a: string, b: string) => {
      const cents = Math.round(Number(a) * 100) + Math.round(Number(b) * 100);

      return (cents / 100).toFixed(2);
    };
    const totals = columnTotals(
      [
        { key: 'name', label: 'Nome', kind: 'text' },
        { key: 'qty', label: 'Qtd', kind: 'number' },
        { key: 'amount', label: 'Valor', kind: 'money' }
      ],
      [
        { name: 'a', qty: 2, amount: '0.10' },
        { name: 'b', qty: 3, amount: '0.20' }
      ],
      add
    );

    expect(totals).toEqual({ qty: 5, amount: '0.30' });
  });

  it('identifica o período com o fuso horário', () => {
    expect(periodLabel({ from: '2026-10-01', to: '2026-10-31' }, 'America/Rio_Branco')).toBe(
      '01/10/2026 a 31/10/2026 (America/Rio_Branco)'
    );
    expect(periodLabel(null, 'America/Rio_Branco')).toContain('Retrato');
  });
});
