import { randomUUID } from 'node:crypto';

import { todayIn } from '../src/common/domain/civil-date';
import { createTestContext, type TestContext, tokenFor } from './helpers';

interface TrendMonth {
  month: string;
  income: { amount: string };
  expense: { amount: string };
  fees: {
    billedDue: { amount: string };
    overdue: { amount: string };
    overdueRate: string | null;
  } | null;
}

describe('Painel financeiro com série mensal (DT-058)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const key = () => ({ 'Idempotency-Key': `test-${randomUUID()}` });

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  const trend = async () =>
    (await ctx.http().get('/api/v1/finance/trend').set(auth(board.token)).expect(200)).body as {
      months: TrendMonth[];
      expectedNext30Days: { amount: string } | null;
    };

  const current = (months: TrendMonth[]) => months[months.length - 1] as TrendMonth;

  it('traz 12 meses em ordem, terminando no mês atual', async () => {
    const { months } = await trend();

    expect(months).toHaveLength(12);
    expect(current(months).month).toBe(todayIn().slice(0, 7));
    expect([...months].map((m) => m.month).sort()).toEqual(months.map((m) => m.month));
  });

  it('soma só lançamentos confirmados do mês, sem transferências', async () => {
    const before = current((await trend()).months);
    const account = (
      await ctx
        .http()
        .post('/api/v1/finance/accounts')
        .set(auth(board.token))
        .send({ name: `Conta ${randomUUID().slice(0, 6)}`, type: 'BANK' })
        .expect(201)
    ).body.id as string;
    const category = async (code: string) =>
      (await ctx.prisma.financialCategory.findUniqueOrThrow({ where: { code } })).id;
    const launch = async (direction: 'INCOME' | 'EXPENSE', amount: string, confirm: boolean) => {
      const created = await ctx
        .http()
        .post('/api/v1/finance/transactions')
        .set(auth(board.token))
        .set(key())
        .send({
          accountId: account,
          categoryId: await category(
            direction === 'INCOME' ? 'outras-receitas' : 'material-esportivo'
          ),
          direction,
          amount,
          occurredOn: todayIn(),
          description: 'Teste do painel'
        })
        .expect(201);

      if (confirm) {
        await ctx
          .http()
          .post(`/api/v1/finance/transactions/${created.body.id}/confirm`)
          .set(auth(board.token))
          .set(key())
          .send({})
          .expect(200);
      }
    };

    await launch('INCOME', '150.00', true);
    await launch('EXPENSE', '40.50', true);
    await launch('INCOME', '999.00', false);

    const after = current((await trend()).months);
    const delta = (a: string, b: string) => (Number(a) - Number(b)).toFixed(2);

    expect(delta(after.income.amount, before.income.amount)).toBe('150.00');
    expect(delta(after.expense.amount, before.expense.amount)).toBe('40.50');
  });

  it('quem não vê mensalidades recebe a série sem a inadimplência', async () => {
    const role = await ctx.prisma.role.findFirstOrThrow({ where: { code: 'board' } });
    const financeOnly = await ctx.prisma.role.create({
      data: {
        code: `caixa-${randomUUID().slice(0, 6)}`,
        name: 'Só Caixa',
        rolePermissions: {
          create: (
            await ctx.prisma.permission.findMany({
              where: { code: { in: ['finance.read', 'dashboard.read'] } }
            })
          ).map((permission) => ({ permissionId: permission.id }))
        }
      }
    });

    expect(role).toBeTruthy();

    const user = await tokenFor(ctx, [financeOnly.code]);
    const body = (await ctx.http().get('/api/v1/finance/trend').set(auth(user.token)).expect(200))
      .body as { months: TrendMonth[]; expectedNext30Days: unknown };

    expect(body.months.every((month) => month.fees === null)).toBe(true);
    expect(body.expectedNext30Days).toBeNull();

    const member = await tokenFor(ctx, ['user']);

    await ctx.http().get('/api/v1/finance/trend').set(auth(member.token)).expect(403);
  });
});
