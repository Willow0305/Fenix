import { periodFor } from './accountability-types';

describe('atalhos de período da prestação de contas (DT-103)', () => {
  it('mês passado vira o ano em janeiro e conhece fevereiro bissexto', () => {
    expect(periodFor('last-month', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(periodFor('last-month', '2028-03-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('trimestre passado', () => {
    expect(periodFor('last-quarter', '2026-11-09')).toEqual({
      from: '2026-07-01',
      to: '2026-09-30'
    });
    expect(periodFor('last-quarter', '2026-02-10')).toEqual({
      from: '2025-10-01',
      to: '2025-12-31'
    });
  });

  it('este mês, este ano e ano passado', () => {
    expect(periodFor('this-month', '2026-11-09')).toEqual({ from: '2026-11-01', to: '2026-11-09' });
    expect(periodFor('this-year', '2026-11-09')).toEqual({ from: '2026-01-01', to: '2026-11-09' });
    expect(periodFor('last-year', '2026-11-09')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });
});
