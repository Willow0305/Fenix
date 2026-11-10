import {
  buildAccountability,
  canonicalJson,
  consistencyProblems,
  contentHash,
  type LedgerRow,
  normalizeVerificationCode,
  periodProblem,
  reportNumber,
  verificationCode
} from './accountability';

function row(
  partial: Partial<LedgerRow> & Pick<LedgerRow, 'id' | 'direction' | 'amount'>
): LedgerRow {
  return {
    accountId: 'caixa',
    origin: 'MANUAL',
    date: '2026-10-10',
    categoryName: 'Outros',
    description: '',
    counterpartyName: null,
    ...partial
  };
}

const base = {
  from: '2026-10-01',
  to: '2026-10-31',
  timeZone: 'America/Rio_Branco',
  currency: 'BRL',
  accounts: [
    { accountId: 'caixa', accountName: 'Caixa', opening: '100.00' },
    { accountId: 'banco', accountName: 'Banco', opening: '400.00' }
  ]
};

describe('prestação de contas (DT-103)', () => {
  const rows: LedgerRow[] = [
    row({
      id: 'm1',
      direction: 'INCOME',
      amount: '50.00',
      origin: 'MONTHLY_FEE',
      categoryName: 'Mensalidades',
      description: 'Mensalidade 10/2026 — Ana Souza'
    }),
    row({
      id: 'm2',
      direction: 'INCOME',
      amount: '50.00',
      origin: 'MONTHLY_FEE',
      categoryName: 'Mensalidades',
      description: 'Mensalidade 10/2026 — Bia Lima'
    }),
    row({
      id: 'p1',
      direction: 'INCOME',
      amount: '120.00',
      origin: 'ORDER',
      categoryName: 'Loja',
      accountId: 'banco'
    }),
    row({
      id: 'e1',
      direction: 'EXPENSE',
      amount: '200.00',
      categoryName: 'Treinadores',
      description: 'Treinador João — outubro',
      date: '2026-10-05'
    }),
    row({
      id: 'e2',
      direction: 'EXPENSE',
      amount: '30.00',
      categoryName: 'Arbitragem',
      description: 'Árbitro jogo 12',
      counterpartyName: 'Liga Acreana',
      date: '2026-10-20'
    }),
    row({
      id: 'r1',
      direction: 'EXPENSE',
      amount: '40.00',
      origin: 'REFUND',
      categoryName: 'Loja',
      description: 'Estorno pedido de Carla',
      accountId: 'banco'
    }),
    row({
      id: 't1',
      direction: 'EXPENSE',
      amount: '60.00',
      origin: 'TRANSFER',
      categoryName: 'Transferências'
    }),
    row({
      id: 't2',
      direction: 'INCOME',
      amount: '60.00',
      origin: 'TRANSFER',
      categoryName: 'Transferências',
      accountId: 'banco'
    })
  ];

  it('entradas só somadas por categoria, sem nome de quem pagou', () => {
    const content = buildAccountability({ ...base, rows, showDetailFor: new Set() });

    expect(content.income.byCategory).toEqual([
      { category: 'Loja', total: { amount: '120.00', currency: 'BRL' } },
      { category: 'Mensalidades', total: { amount: '100.00', currency: 'BRL' } }
    ]);
    expect(JSON.stringify(content)).not.toContain('Ana Souza');
    expect(JSON.stringify(content)).not.toContain('Carla');
  });

  it('saídas da diretoria uma por linha; detalhe só quando marcado', () => {
    const content = buildAccountability({ ...base, rows, showDetailFor: new Set(['e2']) });

    expect(content.expense.lines.map((l) => [l.transactionId, l.date, l.detail])).toEqual([
      ['e1', '2026-10-05', null],
      ['e2', '2026-10-20', 'Árbitro jogo 12 · Recebido por Liga Acreana']
    ]);
    expect(JSON.stringify(content)).not.toContain('João');
    expect(content.expense.refunds).toEqual([
      { category: 'Loja', total: { amount: '40.00', currency: 'BRL' } }
    ]);
  });

  it('transferência não é entrada nem saída e os números fecham', () => {
    const content = buildAccountability({ ...base, rows, showDetailFor: new Set() });

    expect(content.openingBalance.amount).toBe('500.00');
    expect(content.income.total.amount).toBe('220.00');
    expect(content.expense.total.amount).toBe('270.00');
    expect(content.result.amount).toBe('-50.00');
    expect(content.closingBalance.amount).toBe('450.00');
    expect(content.accounts).toEqual([
      {
        name: 'Banco',
        opening: { amount: '400.00', currency: 'BRL' },
        closing: { amount: '540.00', currency: 'BRL' }
      },
      {
        name: 'Caixa',
        opening: { amount: '100.00', currency: 'BRL' },
        closing: { amount: '-90.00', currency: 'BRL' }
      }
    ]);
    expect(consistencyProblems(content)).toEqual([]);
  });

  it('saldo inicial de conta nova no período fica à parte', () => {
    const content = buildAccountability({
      ...base,
      accounts: [{ accountId: 'nova', accountName: 'Conta nova', opening: '0.00' }],
      rows: [
        row({
          id: 'o1',
          accountId: 'nova',
          direction: 'INCOME',
          amount: '300.00',
          origin: 'OPENING_BALANCE'
        })
      ],
      showDetailFor: new Set()
    });

    expect(content.openingEntries.amount).toBe('300.00');
    expect(content.income.total.amount).toBe('0.00');
    expect(content.closingBalance.amount).toBe('300.00');
    expect(consistencyProblems(content)).toEqual([]);
  });

  it('acusa números que não fecham', () => {
    const content = buildAccountability({ ...base, rows, showDetailFor: new Set() });

    expect(
      consistencyProblems({ ...content, closingBalance: { amount: '1.00', currency: 'BRL' } })
    ).toHaveLength(2);
  });

  it('hash e código de conferência não dependem da ordem das chaves', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: null }] })).toBe('{"a":[{"c":null,"d":2}],"b":1}');
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));

    const hash = contentHash({ a: 1 });

    expect(verificationCode(hash)).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(normalizeVerificationCode(verificationCode(hash).toLowerCase())).toBe(hash.slice(0, 12));
    expect(normalizeVerificationCode('123')).toBeNull();
  });

  it('numera por ano e limita o período', () => {
    expect(reportNumber(2026, 7)).toBe('PC-2026-007');
    expect(periodProblem('2026-10-31', '2026-10-01')).toMatch(/antes/);
    expect(periodProblem('2026-01-01', '2028-01-01')).toMatch(/2 anos/);
    expect(periodProblem('2026-01-01', '2026-12-31')).toBeNull();
  });
});
