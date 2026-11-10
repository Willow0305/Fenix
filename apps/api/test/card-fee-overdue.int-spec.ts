import { randomUUID } from 'node:crypto';

import { CardsService } from '../src/modules/cards/application/cards.service';
import { createTestContext, type TestContext, tokenFor } from './helpers';

/** Carteirinha de atleta suspensa por mensalidade atrasada e liberada ao pagar (DT-101). */
describe('Carteirinha e mensalidade atrasada (DT-101)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const key = () => ({ 'Idempotency-Key': `test-${randomUUID()}` });

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
  });

  afterAll(async () => {
    // Volta ao padrão para não afetar outros testes que rodem depois no mesmo banco.
    await ctx.prisma.teamSettings.updateMany({ data: { cardFeeToleranceDays: 10 } });
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  /** Dia civil `days` dias antes de hoje (UTC basta: a margem do teste é de vários dias). */
  function daysAgo(days: number): Date {
    const date = new Date();

    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - days);

    return date;
  }

  /** Atleta ativo com conta e uma mensalidade em aberto vencida há `overdueDays` dias. */
  async function athleteWithFee(overdueDays: number) {
    const holder = await tokenFor(ctx, ['user']);
    const athlete = await ctx.prisma.athlete.create({
      data: { fullName: 'Bruna Atrasada Lima', status: 'ACTIVE', userId: holder.id }
    });
    const plan = await ctx.prisma.monthlyFeePlan.create({
      data: { name: `Plano ${randomUUID().slice(0, 6)}`, amount: '50', currency: 'BRL', dueDay: 10 }
    });
    const due = daysAgo(overdueDays);
    const fee = await ctx.prisma.monthlyFee.create({
      data: {
        athleteId: athlete.id,
        monthlyFeePlanId: plan.id,
        referenceMonth: new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), 1)),
        dueDate: due,
        originalAmount: '50',
        totalAmount: '50',
        currency: 'BRL'
      }
    });

    return { holder, athleteId: athlete.id, feeId: fee.id };
  }

  const athleteCard = async (token: string) => {
    const res = await ctx.http().get('/api/v1/me/cards').set(auth(token)).expect(200);

    return (res.body.cards as { id: string; type: string; state: string }[]).find(
      (card) => card.type === 'ATHLETE'
    );
  };

  it('dentro da tolerância vale; depois dela fica suspensa e avisa uma vez', async () => {
    const recent = await athleteWithFee(5);
    const late = await athleteWithFee(15);

    expect((await athleteCard(recent.holder.token))?.state).toBe('VALID');

    const card = await athleteCard(late.holder.token);

    expect(card?.state).toBe('FEE_OVERDUE');
    // Sem QR para carteirinha suspensa.
    await ctx
      .http()
      .get(`/api/v1/me/cards/${card?.id ?? ''}/qr`)
      .set(auth(late.holder.token))
      .expect(409);

    const cards = ctx.app.get(CardsService);

    expect((await cards.syncFeeBlocks()).blocked).toBeGreaterThanOrEqual(1);
    await cards.syncFeeBlocks();

    expect(
      await ctx.prisma.auditLog.count({
        where: { entityId: card?.id ?? '', action: 'cards.fee_blocked' }
      })
    ).toBe(1);
    expect(
      await ctx.prisma.notification.count({
        where: { userId: late.holder.id, type: 'fee.card_blocked' }
      })
    ).toBe(1);
  });

  it('pagou a mensalidade, volta a valer na hora e o atleta é avisado', async () => {
    const late = await athleteWithFee(20);
    const cards = ctx.app.get(CardsService);

    await athleteCard(late.holder.token);
    await cards.syncFeeBlocks();

    const account = await ctx
      .http()
      .post('/api/v1/finance/accounts')
      .set(auth(board.token))
      .send({ name: `Conta ${randomUUID().slice(0, 6)}`, type: 'BANK' })
      .expect(201);
    const method = await ctx.prisma.paymentMethod.findUniqueOrThrow({ where: { code: 'pix' } });

    await ctx
      .http()
      .post(`/api/v1/monthly-fees/${late.feeId}/payments`)
      .set(auth(board.token))
      .set(key())
      .send({
        amount: '50.00',
        paymentMethodId: method.id,
        paidOn: new Date().toISOString().slice(0, 10),
        accountId: account.body.id
      })
      .expect(201);

    expect((await athleteCard(late.holder.token))?.state).toBe('VALID');
    expect((await cards.syncFeeBlocks()).released).toBeGreaterThanOrEqual(1);
    expect(
      await ctx.prisma.notification.count({
        where: { userId: late.holder.id, type: 'fee.card_released' }
      })
    ).toBe(1);
  });

  it('pagamento parcial não libera; a diretoria muda a tolerância com auditoria', async () => {
    const late = await athleteWithFee(12);

    await ctx.prisma.monthlyFee.update({
      where: { id: late.feeId },
      data: { status: 'PARTIALLY_PAID' }
    });
    expect((await athleteCard(late.holder.token))?.state).toBe('FEE_OVERDUE');

    const athleteOnly = await tokenFor(ctx, ['athlete']);

    await ctx
      .http()
      .put('/api/v1/cards/fee-rule')
      .set(auth(athleteOnly.token))
      .send({ toleranceDays: 30 })
      .expect(403);
    await ctx
      .http()
      .put('/api/v1/cards/fee-rule')
      .set(auth(board.token))
      .send({ toleranceDays: 91 })
      .expect(422);

    const rule = await ctx
      .http()
      .put('/api/v1/cards/fee-rule')
      .set(auth(board.token))
      .send({ toleranceDays: 30 })
      .expect(200);

    expect(rule.body).toEqual({ toleranceDays: 30 });
    expect((await athleteCard(late.holder.token))?.state).toBe('VALID');
    expect(
      await ctx.prisma.auditLog.count({
        where: { actorUserId: board.id, action: 'cards.fee_rule.updated' }
      })
    ).toBeGreaterThanOrEqual(1);
    await ctx
      .http()
      .get('/api/v1/cards/fee-rule')
      .set(auth(board.token))
      .expect(200, { toleranceDays: 30 });
  });
});
