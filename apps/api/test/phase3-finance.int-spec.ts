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
    it('gerencia atletas pelo plano: em massa, troca, exclusão e vencimento (COR-021)', async () => {
      const { feeId, athleteId } = await feeFor('90.00');
      const other = await ctx.prisma.athlete.create({
        data: { fullName: `Atleta Lote ${randomUUID().slice(0, 6)}`, status: 'ACTIVE' }
      });
      const plan = await ctx
        .http()
        .post('/api/v1/fee-plans')
        .set(auth(board.token))
        .send({ name: `Sub-17 ${randomUUID().slice(0, 4)}`, amount: '60.00', dueDay: 5 })
        .expect(201);
      const add = (body: Record<string, unknown>) =>
        ctx
          .http()
          .post(`/api/v1/fee-plans/${plan.body.id}/athletes`)
          .set(auth(board.token))
          .send({ athleteIds: [athleteId, other.id], startsOn: '2024-01-01', ...body })
          .expect(200);

      // Sem troca: quem já tem plano fica de fora e é informado.
      const first = await add({});

      expect(first.body.assigned).toBe(1);
      expect(first.body.skipped).toEqual([
        expect.objectContaining({ athleteId, reason: 'Já tem outro plano vigente.' })
      ]);

      // Com troca: o plano antigo termina na véspera do novo.
      const second = await add({ replaceCurrent: true });

      expect(second.body.assigned).toBe(1);

      const ended = await ctx.prisma.athleteMonthlyFeePlan.findFirstOrThrow({
        where: { athleteId, status: 'ENDED' }
      });

      expect(ended.endsOn?.toISOString().slice(0, 10)).toBe('2023-12-31');

      const members = await ctx
        .http()
        .get(`/api/v1/fee-plans/${plan.body.id}/athletes`)
        .set(auth(board.token))
        .expect(200);

      expect(members.body.map((m: { athlete: { id: string } }) => m.athlete.id).sort()).toEqual(
        [athleteId, other.id].sort()
      );

      // Excluir plano com atletas encerra os vínculos (DT-066); o histórico continua.
      await ctx
        .http()
        .delete(`/api/v1/fee-plans/${plan.body.id}`)
        .set(auth(board.token))
        .send({ reason: 'Teste' })
        .expect(204);
      await expect(
        ctx.prisma.athleteMonthlyFeePlan.count({
          where: { monthlyFeePlanId: plan.body.id, status: 'ACTIVE', endsOn: null }
        })
      ).resolves.toBe(0);

      // Vencimento de uma cobrança em aberto.
      const moved = await ctx
        .http()
        .put(`/api/v1/monthly-fees/${feeId}/due-date`)
        .set(auth(board.token))
        .send({ dueDate: '2031-02-20', reason: 'Combinado com a família' })
        .expect(200);

      expect(moved.body.dueDate).toBe('2031-02-20');

      // Plano sem atletas vigentes pode ser excluído (fica no histórico).
      const empty = await ctx
        .http()
        .post('/api/v1/fee-plans')
        .set(auth(board.token))
        .send({ name: `Vazio ${randomUUID().slice(0, 4)}`, amount: '10.00', dueDay: 1 })
        .expect(201);

      await ctx
        .http()
        .delete(`/api/v1/fee-plans/${empty.body.id}`)
        .set(auth(board.token))
        .send({ reason: 'Criado por engano' })
        .expect(204);
      expect(
        (
          (await ctx.http().get('/api/v1/fee-plans').set(auth(board.token))).body as {
            id: string;
          }[]
        ).map((p) => p.id)
      ).not.toContain(empty.body.id);
    });

    it('plano inativado ou excluído não segue cobrando; dívida passada e pagamentos ficam (DT-066)', async () => {
      const future = await feeFor('70.00');
      const fee = await ctx.prisma.monthlyFee.findUniqueOrThrow({ where: { id: future.feeId } });
      const planId = fee.monthlyFeePlanId;
      // Dívida de um mês passado do mesmo plano: nunca é cancelada.
      const past = await ctx.prisma.monthlyFee.create({
        data: {
          athleteId: future.athleteId,
          monthlyFeePlanId: planId,
          referenceMonth: new Date('2025-01-01T00:00:00Z'),
          dueDate: new Date('2025-01-10T00:00:00Z'),
          originalAmount: '70.00',
          totalAmount: '70.00',
          currency: 'BRL'
        }
      });

      const impact = await ctx
        .http()
        .get(`/api/v1/fee-plans/${planId}/impact`)
        .set(auth(board.token))
        .expect(200);

      expect(impact.body).toEqual({ activeAthletes: 1, cancellableFees: 1, keptOpenFees: 1 });

      // Efeitos sem motivo são recusados.
      await ctx
        .http()
        .patch(`/api/v1/fee-plans/${planId}`)
        .set(auth(board.token))
        .send({ status: 'INACTIVE', cancelFutureFees: true })
        .expect(422);
      await ctx
        .http()
        .patch(`/api/v1/fee-plans/${planId}`)
        .set(auth(board.token))
        .send({
          status: 'INACTIVE',
          cancelFutureFees: true,
          endAthletePlans: true,
          reason: 'Plano substituído pelo novo valor'
        })
        .expect(200);

      const [cancelled, kept, link] = await Promise.all([
        ctx.prisma.monthlyFee.findUniqueOrThrow({ where: { id: future.feeId } }),
        ctx.prisma.monthlyFee.findUniqueOrThrow({ where: { id: past.id } }),
        ctx.prisma.athleteMonthlyFeePlan.findFirstOrThrow({
          where: { monthlyFeePlanId: planId, athleteId: future.athleteId }
        })
      ]);

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancellationReason).toBe('Plano substituído pelo novo valor');
      expect(kept.status).toBe('OPEN');
      expect(link.status).toBe('ENDED');

      // Exclusão: aplica sempre os efeitos e também preserva a dívida passada.
      const other = await feeFor('40.00');
      const otherPlan = (
        await ctx.prisma.monthlyFee.findUniqueOrThrow({ where: { id: other.feeId } })
      ).monthlyFeePlanId;

      await ctx
        .http()
        .delete(`/api/v1/fee-plans/${otherPlan}`)
        .set(auth(board.token))
        .send({ reason: 'Plano descontinuado' })
        .expect(204);
      await expect(
        ctx.prisma.monthlyFee.findUniqueOrThrow({ where: { id: other.feeId } })
      ).resolves.toMatchObject({ status: 'CANCELLED' });
      await ctx
        .http()
        .delete(`/api/v1/fee-plans/${planId}`)
        .set(auth(board.token))
        .send({ reason: 'Fim' })
        .expect(204);
      await expect(
        ctx.prisma.monthlyFee.findUniqueOrThrow({ where: { id: past.id } })
      ).resolves.toMatchObject({ status: 'OPEN' });
    });

    it('ao inativar, aplica só os efeitos escolhidos e preserva dívida passada (COR-018)', async () => {
      const { feeId, athleteId } = await feeFor('70.00');
      const future = await ctx.prisma.monthlyFee.findUniqueOrThrow({ where: { id: feeId } });
      const past = await ctx.prisma.monthlyFee.create({
        data: {
          athleteId,
          monthlyFeePlanId: future.monthlyFeePlanId,
          athleteMonthlyFeePlanId: future.athleteMonthlyFeePlanId,
          referenceMonth: new Date('2020-03-01'),
          dueDate: new Date('2020-03-10'),
          originalAmount: future.originalAmount,
          totalAmount: future.totalAmount,
          currency: future.currency
        }
      });
      const team = await ctx.prisma.team.create({
        data: { name: `Equipe ${randomUUID().slice(0, 6)}`, slug: randomUUID(), type: 'MIXED' }
      });

      await ctx.prisma.teamAthlete.create({
        data: { athleteId, teamId: team.id, startsOn: new Date('2020-01-01') }
      });

      const impact = await ctx
        .http()
        .get(`/api/v1/athletes/${athleteId}/status-impact`)
        .set(auth(board.token))
        .expect(200);

      expect(impact.body).toEqual({
        cancellableFees: 1,
        keptOpenFees: 1,
        activePlan: expect.objectContaining({ name: expect.any(String) }),
        openMemberships: [{ team: team.name }]
      });

      await ctx
        .http()
        .put(`/api/v1/athletes/${athleteId}/status`)
        .set(auth(board.token))
        .send({ status: 'SUSPENDED', reason: 'Teste', endMemberships: true })
        .expect(422);
      await ctx
        .http()
        .put(`/api/v1/athletes/${athleteId}/status`)
        .set(auth(board.token))
        .send({
          status: 'INACTIVE',
          reason: 'Saiu do time',
          cancelFutureFees: true,
          endPlan: true,
          endMemberships: true
        })
        .expect(200);

      expect((await ctx.prisma.monthlyFee.findUniqueOrThrow({ where: { id: feeId } })).status).toBe(
        'CANCELLED'
      );
      expect(
        (await ctx.prisma.monthlyFee.findUniqueOrThrow({ where: { id: past.id } })).status
      ).toBe('OPEN');
      expect(
        await ctx.prisma.athleteMonthlyFeePlan.count({ where: { athleteId, status: 'ACTIVE' } })
      ).toBe(0);
      expect(
        await ctx.prisma.teamAthlete.count({ where: { athleteId, status: 'ACTIVE', endsOn: null } })
      ).toBe(0);
      expect(
        await ctx.prisma.auditLog.count({
          where: { entityId: feeId, action: 'fee.cancelled', reason: 'Saiu do time' }
        })
      ).toBe(1);
    });

    it('gera uma vez por atleta e mês, respeitando o valor do plano ou o individual', async () => {
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

    it('aceita pagamento parcial, lança exatamente uma entrada no Caixa por pagamento e barra pagamento a mais', async () => {
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

    it('é idempotente por chave e recusa reuso por outra pessoa ou chave ausente', async () => {
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

    it('serializa pagamentos simultâneos para a mensalidade nunca ser paga a mais', async () => {
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

    it('estorna pagamento confirmado com reembolso vinculado, sem mexer no lançamento original', async () => {
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

    it('permite ao atleta enviar comprovante PIX e ver só as próprias mensalidades', async () => {
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

    it('ajusta com motivo e recusa cancelar mensalidade com pagamento', async () => {
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
    it('confirma, recusa cancelar lançamento confirmado e estorna uma vez com lançamento vinculado', async () => {
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

    it('recusa categoria incompatível com entrada ou saída', async () => {
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

    it('exclui conta sem uso; com histórico, só inativa e zerada, preservando lançamentos (DT-065)', async () => {
      const unused = await newAccount();
      const used = await newAccount();
      const reason = { reason: 'Conta encerrada no banco' };
      const remove = (id: string, status: number) =>
        ctx
          .http()
          .delete(`/api/v1/finance/accounts/${id}`)
          .set(auth(board.token))
          .send(reason)
          .expect(status);

      await ctx
        .http()
        .post(`/api/v1/finance/accounts/${used}/opening-balance`)
        .set(auth(board.token))
        .set(key())
        .send({ amount: '50.00', occurredOn: '2026-01-01', notes: 'Extrato' })
        .expect(201);

      expect((await remove(used, 409)).body.code).toBe('ACCOUNT_ACTIVE');
      await ctx
        .http()
        .patch(`/api/v1/finance/accounts/${used}`)
        .set(auth(board.token))
        .send({ isActive: false })
        .expect(200);

      const withBalance = await remove(used, 409);

      expect(withBalance.body.code).toBe('BALANCE_NOT_ZERO');
      expect(withBalance.body.detail).toContain('R$ 50,00');

      // Zera o saldo com uma saída confirmada; a conta inativa ainda aceita o acerto.
      const out = await ctx.prisma.financialTransaction.create({
        data: {
          accountId: used,
          categoryId: await categoryId('outras-despesas'),
          direction: 'EXPENSE',
          amount: '50.00',
          currency: 'BRL',
          occurredAt: new Date('2026-01-02T12:00:00Z'),
          competenceDate: new Date('2026-01-02T00:00:00Z'),
          idempotencyKey: `teste-saque-${used}`,
          description: 'Saque para encerrar a conta',
          origin: 'MANUAL',
          status: 'CONFIRMED'
        }
      });

      await remove(used, 204);
      await remove(unused, 204);

      const list = await ctx
        .http()
        .get('/api/v1/finance/accounts')
        .set(auth(board.token))
        .expect(200);
      const ids = (list.body as { id: string }[]).map((a) => a.id);

      expect(ids).not.toContain(used);
      expect(ids).not.toContain(unused);
      // O histórico continua: os dois lançamentos seguem ligados à conta excluída.
      await expect(
        ctx.prisma.financialTransaction.count({ where: { accountId: used } })
      ).resolves.toBe(2);
      await ctx
        .http()
        .get(`/api/v1/finance/transactions/${out.id}`)
        .set(auth(board.token))
        .expect(200);
    });

    it('transfere com dois lançamentos vinculados sem mudar o saldo total', async () => {
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

    it('bloqueia período fechado e exige permissão e motivo para reabrir', async () => {
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

      expect(closed.body.data[0].differenceAmount.amount).toBe('-5.00');

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

      const closingId = closed.body.data[0].id as string;
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

    it('liquida conta a pagar ou receber em exatamente um lançamento', async () => {
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

    it('guarda comprovantes em privado e nega o financeiro a quem não tem permissão', async () => {
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
