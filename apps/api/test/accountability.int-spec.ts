import { randomUUID } from 'node:crypto';

import { createTestContext, type TestContext, tokenFor } from './helpers';

/** Prestação de contas (DT-103): prévia, emissão congelada, PDF, conferência e correção. */
describe('Prestação de contas (DT-103)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let accountId: string;
  let expenseId: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const key = () => ({ 'Idempotency-Key': `test-${randomUUID()}` });
  // Mês só deste teste: os outros testes lançam em 2026.
  const year = 1995 + Math.floor(Math.random() * 20);
  const from = `${year}-03-01`;
  const to = `${year}-03-31`;

  async function categoryId(code: string): Promise<string> {
    return (await ctx.prisma.financialCategory.findUniqueOrThrow({ where: { code } })).id;
  }

  async function confirmed(body: Record<string, unknown>): Promise<string> {
    const created = await ctx
      .http()
      .post('/api/v1/finance/transactions')
      .set(auth(board.token))
      .set(key())
      .send({ accountId, ...body })
      .expect(201);

    await ctx
      .http()
      .post(`/api/v1/finance/transactions/${created.body.id}/confirm`)
      .set(auth(board.token))
      .expect(200);

    return created.body.id as string;
  }

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    await ctx.prisma.user.update({
      where: { id: board.id },
      data: { boardPosition: 'Tesoureiro(a)' }
    });
    accountId = (
      await ctx
        .http()
        .post('/api/v1/finance/accounts')
        .set(auth(board.token))
        .send({ name: `Conta PC ${randomUUID().slice(0, 6)}`, type: 'BANK' })
        .expect(201)
    ).body.id;
    await confirmed({
      categoryId: await categoryId('outras-receitas'),
      direction: 'INCOME',
      amount: '500.00',
      occurredOn: `${year}-03-02`,
      description: 'Doação de Maria Pereira'
    });
    expenseId = await confirmed({
      categoryId: await categoryId('material-esportivo'),
      direction: 'EXPENSE',
      amount: '120.50',
      occurredOn: `${year}-03-10`,
      description: 'Bolas compradas com o técnico Paulo'
    });
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it('prévia: entradas somadas, saídas em linha, detalhe só marcado', async () => {
    const preview = await ctx
      .http()
      .post('/api/v1/accountability-reports/preview')
      .set(auth(board.token))
      .send({ from, to })
      .expect(200);
    const content = preview.body.content;

    expect(preview.body.problems).toEqual([]);
    expect(content.income.total.amount).toBe('500.00');
    expect(content.expense.total.amount).toBe('120.50');
    expect(content.result.amount).toBe('379.50');
    expect(JSON.stringify(content)).not.toContain('Maria Pereira');
    expect(content.expense.lines).toEqual([
      expect.objectContaining({ transactionId: expenseId, detail: null })
    ]);
    expect(preview.body.expenseCandidates).toEqual([
      expect.objectContaining({
        transactionId: expenseId,
        description: 'Bolas compradas com o técnico Paulo'
      })
    ]);
    expect(
      (preview.body.boardMembers as { userId: string; position: string | null }[]).find(
        (m) => m.userId === board.id
      )?.position
    ).toBe('Tesoureiro(a)');
  });

  it('emite congelado, com número, código e PDF; só quem tem permissão', async () => {
    const user = await tokenFor(ctx, ['user']);
    const body = {
      from,
      to,
      showDetailFor: [expenseId],
      signatoryUserIds: [board.id],
      notes: 'Valores aprovados em reunião.'
    };

    await ctx
      .http()
      .post('/api/v1/accountability-reports')
      .set(auth(user.token))
      .set(key())
      .send(body)
      .expect(403);

    const sameKey = key();
    const issued = await ctx
      .http()
      .post('/api/v1/accountability-reports')
      .set(auth(board.token))
      .set(sameKey)
      .send(body)
      .expect(201);
    const again = await ctx
      .http()
      .post('/api/v1/accountability-reports')
      .set(auth(board.token))
      .set(sameKey)
      .send(body)
      .expect(201);

    expect(again.body.id).toBe(issued.body.id);
    expect(issued.body.number).toMatch(/^PC-\d{4}-\d{3}$/);
    expect(issued.body.revision).toBe(1);
    expect(issued.body.status).toBe('ISSUED');
    expect(issued.body.verificationCode).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(issued.body.snapshot.signatories).toEqual([
      { name: expect.any(String), position: 'Tesoureiro(a)' }
    ]);
    expect(issued.body.snapshot.content.expense.lines[0].detail).toBe(
      'Bolas compradas com o técnico Paulo'
    );

    // Lançamento depois da emissão não muda o documento emitido.
    await confirmed({
      categoryId: await categoryId('outras-receitas'),
      direction: 'INCOME',
      amount: '10.00',
      occurredOn: `${year}-03-15`,
      description: 'Rifa'
    });

    const stored = await ctx
      .http()
      .get(`/api/v1/accountability-reports/${issued.body.id}`)
      .set(auth(board.token))
      .expect(200);

    expect(stored.body.snapshot.content.income.total.amount).toBe('500.00');

    const pdf = await ctx
      .http()
      .get(`/api/v1/accountability-reports/${issued.body.id}/pdf`)
      .set(auth(board.token))
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toContain(`${issued.body.number}.pdf`);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    await ctx
      .http()
      .get(`/api/v1/accountability-reports/${issued.body.id}/pdf`)
      .set(auth(user.token))
      .expect(403);

    const checked = await ctx
      .http()
      .get(
        `/api/v1/accountability-reports/verify/${(issued.body.verificationCode as string).toLowerCase()}`
      )
      .set(auth(board.token))
      .expect(200);

    expect(checked.body.found.id).toBe(issued.body.id);
    expect(
      await ctx.prisma.auditLog.count({
        where: { entityId: issued.body.id, action: 'accountability.downloaded' }
      })
    ).toBe(1);

    // O banco recusa mexer no documento emitido.
    await expect(
      ctx.prisma.accountabilityReport.update({
        where: { id: issued.body.id },
        data: { snapshot: { format: 1 } }
      })
    ).rejects.toThrow();
    await expect(
      ctx.prisma.accountabilityReport.delete({ where: { id: issued.body.id } })
    ).rejects.toThrow();
  });

  it('correção vira nova versão com motivo; a anterior fica guardada como substituída', async () => {
    const first = await ctx
      .http()
      .post('/api/v1/accountability-reports')
      .set(auth(board.token))
      .set(key())
      .send({ from, to })
      .expect(201);

    await ctx
      .http()
      .post('/api/v1/accountability-reports')
      .set(auth(board.token))
      .set(key())
      .send({ from, to, replacesId: first.body.id })
      .expect(422);

    const fixed = await ctx
      .http()
      .post('/api/v1/accountability-reports')
      .set(auth(board.token))
      .set(key())
      .send({
        from,
        to,
        replacesId: first.body.id,
        replacementReason: 'Faltou a rifa lançada depois da reunião.'
      })
      .expect(201);

    expect(fixed.body.number).toBe(first.body.number);
    expect(fixed.body.revision).toBe(2);
    expect(fixed.body.snapshot.replaces).toEqual({
      revision: 1,
      reason: 'Faltou a rifa lançada depois da reunião.'
    });

    const old = await ctx
      .http()
      .get(`/api/v1/accountability-reports/${first.body.id}`)
      .set(auth(board.token))
      .expect(200);

    expect(old.body.status).toBe('REPLACED');
    expect(old.body.replacedById).toBe(fixed.body.id);

    const twice = await ctx
      .http()
      .post('/api/v1/accountability-reports')
      .set(auth(board.token))
      .set(key())
      .send({
        from,
        to,
        replacesId: first.body.id,
        replacementReason: 'Segunda correção da versão antiga.'
      })
      .expect(409);

    expect(twice.body.code).toBe('ALREADY_REPLACED');
  });

  it('recusa período invertido ou maior que 2 anos', async () => {
    await ctx
      .http()
      .post('/api/v1/accountability-reports/preview')
      .set(auth(board.token))
      .send({ from: to, to: from })
      .expect(422);
    await ctx
      .http()
      .post('/api/v1/accountability-reports/preview')
      .set(auth(board.token))
      .send({ from: '2020-01-01', to: '2023-01-01' })
      .expect(422);
  });
});
