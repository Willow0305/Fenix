import { randomUUID } from 'node:crypto';

import {
  createTestContext,
  createUser,
  login,
  PNG_1X1,
  type TestContext,
  tokenFor
} from './helpers';

describe('Fase 3 — mensalidades e Caixa Fênix', () => {
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

  async function newAccount(): Promise<string> {
    const res = await ctx
      .http()
      .post('/api/v1/finance/accounts')
      .set(auth(board.token))
      .send({ name: `Conta ${randomUUID().slice(0, 6)}`, type: 'BANK' })
      .expect(201);

    return res.body.id as string;
  }

  async function categoryId(code: string): Promise<string> {
    return (await ctx.prisma.financialCategory.findUniqueOrThrow({ where: { code } })).id;
  }

  async function methodId(code = 'pix'): Promise<string> {
    return (await ctx.prisma.paymentMethod.findUniqueOrThrow({ where: { code } })).id;
  }

  async function balanceOf(accountId: string): Promise<string> {
    const summary = await ctx
      .http()
      .get('/api/v1/finance/summary?from=2000-01-01&to=2100-12-31')
      .set(auth(board.token))
      .expect(200);

    return summary.body.balances.find((b: { accountId: string }) => b.accountId === accountId)
      .balance.amount as string;
  }

  /** Atleta ativo com plano e mensalidade gerada para um mês exclusivo do teste. */
  async function feeFor(
    amount = '100.00',
    options: { userId?: string; override?: string } = {}
  ): Promise<{ feeId: string; athleteId: string; month: string }> {
    const athlete = await ctx.prisma.athlete.create({
      data: {
        fullName: `Atleta Fin ${randomUUID().slice(0, 6)}`,
        status: 'ACTIVE',
        ...(options.userId ? { userId: options.userId } : {})
      }
    });
    const plan = await ctx
      .http()
      .post('/api/v1/fee-plans')
      .set(auth(board.token))
      .send({ name: `Plano ${randomUUID().slice(0, 4)}`, amount, dueDay: 10 })
      .expect(201);

    await ctx
      .http()
      .post(`/api/v1/athletes/${athlete.id}/fee-plans`)
      .set(auth(board.token))
      .send({
        planId: plan.body.id,
        startsOn: '2020-01-01',
        ...(options.override ? { amountOverride: options.override, reason: 'Bolsa parcial' } : {})
      })
      .expect(201);

    const year = 2030 + Math.floor(Math.random() * 60);
    const month = `${year}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}`;

    await ctx
      .http()
      .post('/api/v1/monthly-fees/generate')
      .set(auth(board.token))
      .send({ referenceMonth: month })
      .expect(200);

    const fee = await ctx.prisma.monthlyFee.findFirstOrThrow({ where: { athleteId: athlete.id } });

    return { feeId: fee.id, athleteId: athlete.id, month };
  }

  describe('mensalidades', () => {
    it('generates once per athlete and month, preserving the plan amount or override', async () => {
      const { athleteId, month } = await feeFor('80.00', { override: '50.00' });
      const again = await ctx
        .http()
        .post('/api/v1/monthly-fees/generate')
        .set(auth(board.token))
        .send({ referenceMonth: month })
        .expect(200);

      expect(again.body.created).toBe(0);
      expect(await ctx.prisma.monthlyFee.count({ where: { athleteId } })).toBe(1);

      const fee = await ctx.prisma.monthlyFee.findFirstOrThrow({ where: { athleteId } });

      expect(fee.totalAmount.toFixed(2)).toBe('50.00');
      expect(fee.dueDate.toISOString().slice(0, 10)).toBe(`${month}-10`);
    });

    it('accepts partial payments, posts exactly one cash entry each and blocks overpayment', async () => {
      const accountId = await newAccount();
      const { feeId } = await feeFor('100.00');
      const pay = (amount: string) =>
        ctx
          .http()
          .post(`/api/v1/monthly-fees/${feeId}/payments`)
          .set(auth(board.token))
          .set(key())
          .send({ amount, paymentMethodId: '', paidOn: '2026-10-10', accountId });
      const method = await methodId();
      const first = await ctx
        .http()
        .post(`/api/v1/monthly-fees/${feeId}/payments`)
        .set(auth(board.token))
        .set(key())
        .send({ amount: '40.00', paymentMethodId: method, paidOn: '2026-10-10', accountId })
        .expect(201);

      expect(first.body.status).toMatch(/PARTIALLY_PAID|OVERDUE/);
      expect(first.body.paidAmount.amount).toBe('40.00');
      expect(first.body.remainingAmount.amount).toBe('60.00');
      await pay('10.00').expect(422);

      const over = await ctx
        .http()
        .post(`/api/v1/monthly-fees/${feeId}/payments`)
        .set(auth(board.token))
        .set(key())
        .send({ amount: '60.01', paymentMethodId: method, paidOn: '2026-10-10', accountId })
        .expect(422);

      expect(over.body.code).toBe('AMOUNT_EXCEEDS_BALANCE');

      const second = await ctx
        .http()
        .post(`/api/v1/monthly-fees/${feeId}/payments`)
        .set(auth(board.token))
        .set(key())
        .send({ amount: '60.00', paymentMethodId: method, paidOn: '2026-10-11', accountId })
        .expect(201);

      expect(second.body.status).toBe('PAID');
      expect(await balanceOf(accountId)).toBe('100.00');

      const entries = await ctx.prisma.financialTransaction.findMany({
        where: { accountId, origin: 'MONTHLY_FEE' }
      });

      expect(entries).toHaveLength(2);
      expect(
        entries.every((entry) => entry.paymentId !== null && entry.status === 'CONFIRMED')
      ).toBe(true);
    });

    it('is idempotent per key and rejects reuse by another user or a missing key', async () => {
      const accountId = await newAccount();
      const { feeId } = await feeFor('70.00');
      const body = {
        amount: '70.00',
        paymentMethodId: await methodId(),
        paidOn: '2026-10-10',
        accountId
      };
      const sameKey = { 'Idempotency-Key': `same-${randomUUID()}` };

      await ctx
        .http()
        .post(`/api/v1/monthly-fees/${feeId}/payments`)
        .set(auth(board.token))
        .send(body)
        .expect(400);
      await ctx
        .http()
        .post(`/api/v1/monthly-fees/${feeId}/payments`)
        .set(auth(board.token))
        .set(sameKey)
        .send(body)
        .expect(201);
      await ctx
        .http()
        .post(`/api/v1/monthly-fees/${feeId}/payments`)
        .set(auth(board.token))
        .set(sameKey)
        .send(body)
        .expect(201);

      const other = await tokenFor(ctx, ['board']);

      await ctx
        .http()
        .post(`/api/v1/monthly-fees/${feeId}/payments`)
        .set(auth(other.token))
        .set(sameKey)
        .send(body)
        .expect(409);
      expect(await ctx.prisma.monthlyFeePayment.count({ where: { monthlyFeeId: feeId } })).toBe(1);
      expect(await balanceOf(accountId)).toBe('70.00');
    });

    it('serializes concurrent payments so the fee is never overpaid', async () => {
      const accountId = await newAccount();
      const { feeId } = await feeFor('50.00');
      const method = await methodId();
      const attempt = () =>
        ctx
          .http()
          .post(`/api/v1/monthly-fees/${feeId}/payments`)
          .set(auth(board.token))
          .set(key())
          .send({ amount: '50.00', paymentMethodId: method, paidOn: '2026-10-10', accountId });
      const results = await Promise.all([attempt(), attempt(), attempt()]);

      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(await balanceOf(accountId)).toBe('50.00');
    });

    it('reverses a confirmed payment with a linked refund without touching the original entry', async () => {
      const accountId = await newAccount();
      const { feeId } = await feeFor('90.00');
      const paid = await ctx
        .http()
        .post(`/api/v1/monthly-fees/${feeId}/payments`)
        .set(auth(board.token))
        .set(key())
        .send({
          amount: '90.00',
          paymentMethodId: await methodId('dinheiro'),
          paidOn: '2026-10-10',
          accountId
        })
        .expect(201);
      const paymentId = paid.body.payments[0].id as string;
      const original = await ctx.prisma.financialTransaction.findUniqueOrThrow({
        where: { paymentId }
      });

      await ctx
        .http()
        .post(`/api/v1/monthly-fees/${feeId}/payments/${paymentId}/reverse`)
        .set(auth(board.token))
        .set(key())
        .send({})
        .expect(422);

      const reversed = await ctx
        .http()
        .post(`/api/v1/monthly-fees/${feeId}/payments/${paymentId}/reverse`)
        .set(auth(board.token))
        .set(key())
        .send({ reason: 'Pagamento lançado no atleta errado' })
        .expect(200);

      expect(reversed.body.paidAmount.amount).toBe('0.00');
      expect(reversed.body.payments[0].status).toBe('REFUNDED');
      expect(await balanceOf(accountId)).toBe('0.00');

      const after = await ctx.prisma.financialTransaction.findUniqueOrThrow({
        where: { id: original.id }
      });
      const reversal = await ctx.prisma.financialTransaction.findFirstOrThrow({
        where: { reversesTransactionId: original.id }
      });

      expect(after.status).toBe('CONFIRMED');
      expect(after.amount.toFixed(2)).toBe('90.00');
      expect(reversal.direction).toBe('EXPENSE');
      expect(reversal.origin).toBe('REFUND');
      expect(reversal.refundId).not.toBeNull();
    });

    it('lets the athlete send a PIX proof and see only their own fees', async () => {
      const athleteUser = await createUser(ctx.prisma, ['user', 'athlete']);
      const athleteToken = await login(ctx, athleteUser.email);
      const { feeId } = await feeFor('60.00', { userId: athleteUser.id });
      const { feeId: otherFee } = await feeFor('60.00');
      const accountId = await newAccount();

      const mine = await ctx
        .http()
        .get('/api/v1/me/monthly-fees')
        .set(auth(athleteToken))
        .expect(200);

      const mineIds = mine.body.map((f: { id: string }) => f.id);

      expect(mineIds).toContain(feeId);
      expect(mineIds).not.toContain(otherFee);
      await ctx
        .http()
        .get(`/api/v1/me/monthly-fees/${otherFee}`)
        .set(auth(athleteToken))
        .expect(404);
      await ctx.http().get('/api/v1/monthly-fees').set(auth(athleteToken)).expect(403);

      const proof = await ctx
        .http()
        .post(`/api/v1/me/monthly-fees/${feeId}/proof`)
        .set(auth(athleteToken))
        .set(key())
        .field('amount', '60.00')
        .field('paidOn', '2026-10-09')
        .attach('file', PNG_1X1, 'comprovante.png')
        .expect(201);

      expect(proof.body.pendingAmount.amount).toBe('60.00');
      expect(await balanceOf(accountId)).toBe('0.00');

      const paymentId = proof.body.payments[0].id as string;
      const attachmentId = proof.body.payments[0].attachments[0].id as string;

      await ctx
        .http()
        .get(`/api/v1/payments/${paymentId}/attachments/${attachmentId}`)
        .set(auth(athleteToken))
        .expect(200);
      await ctx
        .http()
        .get(`/api/v1/payments/${paymentId}/attachments/${attachmentId}`)
        .set(auth((await tokenFor(ctx, ['user'])).token))
        .expect(404);

      const confirmed = await ctx
        .http()
        .post(`/api/v1/monthly-fees/${feeId}/payments/${paymentId}/confirm`)
        .set(auth(board.token))
        .send({ accountId })
        .expect(200);

      expect(confirmed.body.status).toBe('PAID');
      expect(await balanceOf(accountId)).toBe('60.00');

      const notifications = await ctx
        .http()
        .get('/api/v1/me/notifications')
        .set(auth(athleteToken))
        .expect(200);

      expect(notifications.body.data.map((n: { type: string }) => n.type)).toEqual(
        expect.arrayContaining(['fee.created', 'fee.payment.confirmed'])
      );
    });

    it('adjusts with reason and refuses to cancel fees with payments', async () => {
      const accountId = await newAccount();
      const { feeId } = await feeFor('100.00');

      const adjusted = await ctx
        .http()
        .post(`/api/v1/monthly-fees/${feeId}/adjust`)
        .set(auth(board.token))
        .send({ discountAmount: '25.00', reason: 'Desconto irmãos' })
        .expect(200);

      expect(adjusted.body.totalAmount.amount).toBe('75.00');
      await ctx
        .http()
        .post(`/api/v1/monthly-fees/${feeId}/payments`)
        .set(auth(board.token))
        .set(key())
        .send({
          amount: '10.00',
          paymentMethodId: await methodId(),
          paidOn: '2026-10-10',
          accountId
        })
        .expect(201);
      await ctx
        .http()
        .post(`/api/v1/monthly-fees/${feeId}/cancel`)
        .set(auth(board.token))
        .send({ reason: 'Teste' })
        .expect(409);
      await ctx
        .http()
        .post(`/api/v1/monthly-fees/${feeId}/adjust`)
        .set(auth(board.token))
        .send({ discountAmount: '95.00', reason: 'Abaixo do pago' })
        .expect(409);
    });
  });

  describe('Caixa Fênix', () => {
    it('confirms, refuses to cancel confirmed entries and reverses once with a linked entry', async () => {
      const accountId = await newAccount();
      const created = await ctx
        .http()
        .post('/api/v1/finance/transactions')
        .set(auth(board.token))
        .set(key())
        .send({
          accountId,
          categoryId: await categoryId('material-esportivo'),
          direction: 'EXPENSE',
          amount: '35.90',
          occurredOn: '2026-10-05',
          description: 'Bolas'
        })
        .expect(201);

      expect(created.body.status).toBe('PENDING');
      expect(await balanceOf(accountId)).toBe('0.00');
      await ctx
        .http()
        .post(`/api/v1/finance/transactions/${created.body.id}/confirm`)
        .set(auth(board.token))
        .expect(200);
      expect(await balanceOf(accountId)).toBe('-35.90');
      await ctx
        .http()
        .post(`/api/v1/finance/transactions/${created.body.id}/cancel`)
        .set(auth(board.token))
        .send({ reason: 'erro' })
        .expect(409);

      const reversal = await ctx
        .http()
        .post(`/api/v1/finance/transactions/${created.body.id}/reverse`)
        .set(auth(board.token))
        .set(key())
        .send({ reason: 'Compra devolvida' })
        .expect(201);

      expect(reversal.body.reversesTransactionId).toBe(created.body.id);
      expect(await balanceOf(accountId)).toBe('0.00');
      await ctx
        .http()
        .post(`/api/v1/finance/transactions/${created.body.id}/reverse`)
        .set(auth(board.token))
        .set(key())
        .send({ reason: 'de novo' })
        .expect(409);
      await ctx
        .http()
        .post(`/api/v1/finance/transactions/${reversal.body.id}/reverse`)
        .set(auth(board.token))
        .set(key())
        .send({ reason: 'estorno do estorno' })
        .expect(409);
    });

    it('rejects categories incompatible with the direction', async () => {
      const accountId = await newAccount();

      await ctx
        .http()
        .post('/api/v1/finance/transactions')
        .set(auth(board.token))
        .set(key())
        .send({
          accountId,
          categoryId: await categoryId('mensalidades'),
          direction: 'EXPENSE',
          amount: '10.00',
          occurredOn: '2026-10-05',
          description: 'Errado'
        })
        .expect(422);
      await ctx
        .http()
        .post('/api/v1/finance/transactions')
        .set(auth(board.token))
        .set(key())
        .send({
          accountId,
          categoryId: await categoryId('outras-receitas'),
          direction: 'INCOME',
          amount: '10.001',
          occurredOn: '2026-10-05',
          description: 'Precisão'
        })
        .expect(422);
    });

    it('transfers with two linked legs without changing the total balance', async () => {
      const a = await newAccount();
      const b = await newAccount();

      await ctx
        .http()
        .post(`/api/v1/finance/accounts/${a}/opening-balance`)
        .set(auth(board.token))
        .set(key())
        .send({ amount: '500.00', occurredOn: '2026-01-01', notes: 'Extrato inicial' })
        .expect(201);
      await ctx
        .http()
        .post(`/api/v1/finance/accounts/${a}/opening-balance`)
        .set(auth(board.token))
        .set(key())
        .send({ amount: '1.00', occurredOn: '2026-01-01', notes: 'Duplicado' })
        .expect(409);

      const transfer = await ctx
        .http()
        .post('/api/v1/finance/transfers')
        .set(auth(board.token))
        .set(key())
        .send({
          sourceAccountId: a,
          destinationAccountId: b,
          amount: '120.50',
          occurredOn: '2026-10-01'
        })
        .expect(201);

      expect(await balanceOf(a)).toBe('379.50');
      expect(await balanceOf(b)).toBe('120.50');
      await ctx
        .http()
        .post(`/api/v1/finance/transactions/${transfer.body.debit.id}/reverse`)
        .set(auth(board.token))
        .set(key())
        .send({ reason: 'Tentativa inválida' })
        .expect(409);

      const summary = await ctx
        .http()
        .get('/api/v1/finance/summary?from=2026-10-01&to=2026-10-01')
        .set(auth(board.token))
        .expect(200);

      expect(
        summary.body.byCategory.find((c: { categoryName: string }) =>
          c.categoryName.startsWith('Transfer')
        )
      ).toBeUndefined();
    });

    it('locks closed periods and requires permission and reason to reopen', async () => {
      const accountId = await newAccount();
      const income = await categoryId('outras-receitas');

      await ctx
        .http()
        .post('/api/v1/finance/transactions')
        .set(auth(board.token))
        .set(key())
        .send({
          accountId,
          categoryId: income,
          direction: 'INCOME',
          amount: '200.00',
          occurredOn: '2026-09-10',
          description: 'Rifa',
          confirmNow: true
        })
        .expect(201);

      const preview = await ctx
        .http()
        .get(
          `/api/v1/finance/closings/preview?accountId=${accountId}&periodStart=2026-09-01&periodEnd=2026-09-30`
        )
        .set(auth(board.token))
        .expect(200);

      expect(preview.body.expectedBalance.amount).toBe('200.00');

      const closed = await ctx
        .http()
        .post('/api/v1/finance/closings')
        .set(auth(board.token))
        .set(key())
        .send({
          accountId,
          periodStart: '2026-09-01',
          periodEnd: '2026-09-30',
          countedBalance: '195.00',
          notes: 'Faltaram R$ 5'
        })
        .expect(201);

      expect(closed.body[0].differenceAmount.amount).toBe('-5.00');

      const blocked = await ctx
        .http()
        .post('/api/v1/finance/transactions')
        .set(auth(board.token))
        .set(key())
        .send({
          accountId,
          categoryId: income,
          direction: 'INCOME',
          amount: '10.00',
          occurredOn: '2026-09-15',
          description: 'Retroativo',
          confirmNow: true
        })
        .expect(409);

      expect(blocked.body.code).toBe('PERIOD_CLOSED');

      const closingId = closed.body[0].id as string;
      const role = await ctx.prisma.role.findUniqueOrThrow({ where: { code: 'board' } });
      const reopenPermission = await ctx.prisma.permission.findUniqueOrThrow({
        where: { code: 'cash.reopen' }
      });
      const limitedRole = await ctx.prisma.role.create({
        data: { code: `fin-${randomUUID().slice(0, 6)}`, name: 'Financeiro sem reabertura' }
      });
      const boardPermissions = await ctx.prisma.rolePermission.findMany({
        where: { roleId: role.id, permissionId: { not: reopenPermission.id } }
      });

      await ctx.prisma.rolePermission.createMany({
        data: boardPermissions.map((rp) => ({
          roleId: limitedRole.id,
          permissionId: rp.permissionId
        }))
      });

      const limited = await tokenFor(ctx, [limitedRole.code]);

      await ctx
        .http()
        .post(`/api/v1/finance/closings/${closingId}/reopen`)
        .set(auth(limited.token))
        .send({ reason: 'Ajuste' })
        .expect(403);
      await ctx
        .http()
        .post(`/api/v1/finance/closings/${closingId}/reopen`)
        .set(auth(board.token))
        .send({})
        .expect(422);
      await ctx
        .http()
        .post(`/api/v1/finance/closings/${closingId}/reopen`)
        .set(auth(board.token))
        .send({ reason: 'Recontagem do caixa' })
        .expect(200);
      await ctx
        .http()
        .post('/api/v1/finance/transactions')
        .set(auth(board.token))
        .set(key())
        .send({
          accountId,
          categoryId: income,
          direction: 'INCOME',
          amount: '10.00',
          occurredOn: '2026-09-15',
          description: 'Retroativo',
          confirmNow: true
        })
        .expect(201);

      const audit = await ctx.prisma.auditLog.findFirst({
        where: { entityId: closingId, action: 'finance.closing.reopened' }
      });

      expect(audit?.reason).toBe('Recontagem do caixa');
    });

    it('settles obligations into exactly one cash entry', async () => {
      const accountId = await newAccount();
      const obligation = await ctx
        .http()
        .post('/api/v1/finance/obligations')
        .set(auth(board.token))
        .set(key())
        .send({
          type: 'PAYABLE',
          categoryId: await categoryId('aluguel-quadra'),
          counterpartyName: 'Ginásio Municipal',
          description: 'Aluguel outubro',
          competenceDate: '2026-10-01',
          dueDate: '2026-10-15',
          amount: '300.00'
        })
        .expect(201);
      const url = `/api/v1/finance/obligations/${obligation.body.id}`;

      await ctx
        .http()
        .post(`${url}/settle`)
        .set(auth(board.token))
        .send({ accountId, paidOn: '2026-10-14' })
        .expect(200);
      await ctx
        .http()
        .post(`${url}/settle`)
        .set(auth(board.token))
        .send({ accountId, paidOn: '2026-10-14' })
        .expect(409);
      await ctx
        .http()
        .post(`${url}/cancel`)
        .set(auth(board.token))
        .send({ reason: 'Tentativa inválida' })
        .expect(409);
      expect(await balanceOf(accountId)).toBe('-300.00');
    });

    it('stores receipts privately and denies finance to non-authorized users', async () => {
      const accountId = await newAccount();
      const created = await ctx
        .http()
        .post('/api/v1/finance/transactions')
        .set(auth(board.token))
        .set(key())
        .send({
          accountId,
          categoryId: await categoryId('transporte'),
          direction: 'EXPENSE',
          amount: '42.00',
          occurredOn: '2026-10-05',
          description: 'Van',
          confirmNow: true
        })
        .expect(201);
      const attached = await ctx
        .http()
        .post(`/api/v1/finance/transactions/${created.body.id}/attachments`)
        .set(auth(board.token))
        .attach('file', PNG_1X1, 'recibo.png')
        .expect(201);
      const attachment = attached.body.attachments[0];

      await ctx
        .http()
        .get(`/api/v1/finance/transactions/${created.body.id}/attachments/${attachment.id}`)
        .set(auth(board.token))
        .expect(200);
      await ctx.http().get(`/api/v1/media/${attachment.mediaFileId}`).expect(404);

      const user = await tokenFor(ctx, ['user']);

      await ctx
        .http()
        .get('/api/v1/finance/summary?from=2026-01-01&to=2026-12-31')
        .set(auth(user.token))
        .expect(403);
      await ctx.http().get('/api/v1/finance/transactions').set(auth(user.token)).expect(403);
    });
  });
});
