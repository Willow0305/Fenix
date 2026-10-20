import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { todayIn } from '../src/common/domain/civil-date';
import { endOfDayExclusive, startOfDayInZone } from '../src/common/domain/time-zone';
import {
  createTestContext,
  createUser,
  login,
  PASSWORD,
  type TestContext,
  tokenFor
} from './helpers';

describe('Fase 8 — relatórios, auditoria e privacidade', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let admin: { token: string; id: string };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const today = todayIn();

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    admin = await tokenFor(ctx, ['admin']);
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  /** Produto vendido e pago hoje, com nome que tentaria virar fórmula na planilha. */
  async function sellProduct(name: string, price: string): Promise<string> {
    const category = await ctx
      .http()
      .post('/api/v1/store/categories')
      .set(auth(board.token))
      .send({ name: `Rel ${randomUUID().slice(0, 5)}` })
      .expect(201);
    const product = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name,
        categoryId: category.body.id,
        fulfillmentType: 'MADE_TO_ORDER',
        basePrice: price
      })
      .expect(201);

    await ctx
      .http()
      .put(`/api/v1/store/products/${product.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    const agent = request.agent(ctx.app.getHttpServer());

    await agent
      .put('/api/v1/cart/items')
      .send({ variantId: product.body.variants[0].id, quantity: 1 })
      .expect(200);

    const order = await agent
      .post('/api/v1/orders/checkout')
      .send({
        customerName: 'Cliente Relatório',
        customerEmail: `r-${randomUUID().slice(0, 6)}@exemplo.test`,
        customerPhone: '68 99999-5555',
        acceptTerms: true
      })
      .expect(201);
    const pix = await ctx.prisma.paymentMethod.findUniqueOrThrow({ where: { code: 'pix' } });
    const account = await ctx
      .http()
      .post('/api/v1/finance/accounts')
      .set(auth(board.token))
      .send({ name: `Conta R ${randomUUID().slice(0, 5)}`, type: 'BANK' })
      .expect(201);

    await ctx
      .http()
      .post(`/api/v1/store/orders/${order.body.order.id}/payments`)
      .set(auth(board.token))
      .set({ 'Idempotency-Key': `test-${randomUUID()}` })
      .send({ paymentMethodId: pix.id, paidOn: today, accountId: account.body.id })
      .expect(201);

    return order.body.order.id as string;
  }

  it('separates report reading from exporting', async () => {
    const role = await ctx.prisma.role.create({
      data: {
        code: `leitor-${randomUUID().slice(0, 6)}`,
        name: 'Leitor de relatórios',
        rolePermissions: {
          create: [
            {
              permission: { connect: { code: 'reports.read' } }
            }
          ]
        }
      }
    });
    const reader = await createUser(ctx.prisma, [role.code]);
    const token = await login(ctx, reader.email);

    await ctx.http().get('/api/v1/reports').set(auth(token)).expect(200);
    await ctx.http().get('/api/v1/reports/athletes').set(auth(token)).expect(200);
    await ctx.http().get('/api/v1/reports/athletes/csv').set(auth(token)).expect(403);

    const user = await tokenFor(ctx, ['user']);

    await ctx.http().get('/api/v1/reports/athletes').set(auth(user.token)).expect(403);

    const missing = await ctx.http().get('/api/v1/reports/fees').set(auth(board.token)).expect(422);

    expect(missing.body.code).toBe('PERIOD_REQUIRED');
    await ctx.http().get('/api/v1/reports/nao-existe').set(auth(board.token)).expect(404);

    const athletes = await ctx
      .http()
      .get('/api/v1/reports/athletes')
      .set(auth(board.token))
      .expect(200);

    expect(athletes.body.columns.map((c: { key: string }) => c.key)).toEqual([
      'team',
      'status',
      'count'
    ]);
  });

  it('reconciles sales and cash totals with the source and exports a safe, audited CSV', async () => {
    await sellProduct(`=HYPERLINK("http://x") ${randomUUID().slice(0, 4)}`, '42.50');

    const sales = await ctx
      .http()
      .get(`/api/v1/reports/sales-products?from=${today}&to=${today}`)
      .set(auth(board.token))
      .expect(200);
    const source = await ctx.prisma.orderItem.aggregate({
      where: {
        order: {
          status: { in: ['PAID', 'PROCESSING', 'READY_FOR_PICKUP', 'DELIVERED'] },
          paidAt: { gte: startOfDayInZone(today), lt: endOfDayExclusive(today) }
        }
      },
      _sum: { totalAmount: true }
    });

    expect(sales.body.totals.gross).toBe(source._sum.totalAmount?.toFixed(2));
    expect(sales.body.timeZone).toBe('America/Rio_Branco');

    const cash = await ctx
      .http()
      .get(`/api/v1/reports/cash?from=${today}&to=${today}&groupBy=origin`)
      .set(auth(board.token))
      .expect(200);
    const income = await ctx.prisma.financialTransaction.aggregate({
      where: {
        status: 'CONFIRMED',
        direction: 'INCOME',
        origin: { not: 'TRANSFER' },
        occurredAt: { gte: startOfDayInZone(today), lt: endOfDayExclusive(today) }
      },
      _sum: { amount: true }
    });

    expect(cash.body.totals.income).toBe(income._sum.amount?.toFixed(2));

    const csv = await ctx
      .http()
      .get(`/api/v1/reports/sales-products/csv?from=${today}&to=${today}`)
      .set(auth(board.token))
      .expect(200);
    const text = csv.text.replace(/^\uFEFF/, '');
    const br = today.split('-').reverse().join('/');

    expect(csv.headers['content-type']).toContain('text/csv');
    expect(text).toContain(`# Período: ${br} a ${br} (America/Rio_Branco)`);
    expect(text).toContain('"\'=HYPERLINK(');
    expect(text).not.toMatch(/(^|;)=HYPERLINK/m);

    const audited = await ctx.prisma.auditLog.findFirst({
      where: { action: 'report.exported', actorUserId: board.id },
      orderBy: { occurredAt: 'desc' }
    });

    expect(audited?.afterData).toMatchObject({ report: 'sales-products', from: today, to: today });
  });

  it('shows audit details with related actions and filters by civil date', async () => {
    const created = await ctx
      .http()
      .post('/api/v1/news-categories')
      .set(auth(board.token))
      .set({ 'X-Request-Id': randomUUID() })
      .send({ name: `Auditoria ${randomUUID().slice(0, 5)}` })
      .expect(201);
    const list = await ctx
      .http()
      .get(`/api/v1/audit-logs?entityId=${created.body.id}&from=${today}&to=${today}`)
      .set(auth(admin.token))
      .expect(200);

    expect(list.body.data).toHaveLength(1);

    const detail = await ctx
      .http()
      .get(`/api/v1/audit-logs/${list.body.data[0].id}`)
      .set(auth(admin.token))
      .expect(200);

    expect(detail.body.action).toBe('news.category.created');
    expect(Array.isArray(detail.body.related)).toBe(true);

    const types = await ctx
      .http()
      .get('/api/v1/audit-logs/entity-types')
      .set(auth(admin.token))
      .expect(200);

    expect(types.body).toContain('NewsCategory');
    await ctx
      .http()
      .get(`/api/v1/audit-logs/${list.body.data[0].id}`)
      .set(auth(board.token))
      .expect(403);
  });

  it('lets the data subject export data and request erasure, fulfilled by anonymization', async () => {
    const subject = await tokenFor(ctx, ['user']);
    const subjectRow = await ctx.prisma.user.findUniqueOrThrow({ where: { id: subject.id } });
    const exported = await ctx
      .http()
      .get('/api/v1/me/privacy/export')
      .set(auth(subject.token))
      .expect(200);
    const data = JSON.parse(exported.text) as { account: Record<string, unknown> };

    expect(data.account['email']).toBe(subjectRow.email);
    expect(exported.text).not.toContain('passwordHash');

    // Conteúdo publicado no fórum é anonimizado na eliminação.
    const category = await ctx
      .http()
      .post('/api/v1/forum/admin/categories')
      .set(auth(board.token))
      .send({ name: `LGPD ${randomUUID().slice(0, 5)}`, visibility: 'PUBLIC' })
      .expect(201);
    const topic = await ctx
      .http()
      .post(`/api/v1/forum/categories/${category.body.slug}/topics`)
      .set(auth(subject.token))
      .send({ title: 'Meu tópico', content: 'Meu telefone é 68 99999-0000' })
      .expect(201);

    const first = await ctx
      .http()
      .post('/api/v1/me/privacy/requests')
      .set(auth(subject.token))
      .send({ type: 'ERASURE', details: 'Quero excluir minha conta.' })
      .expect(201);
    const again = await ctx
      .http()
      .post('/api/v1/me/privacy/requests')
      .set(auth(subject.token))
      .send({ type: 'ERASURE' })
      .expect(201);

    expect(again.body.id).toBe(first.body.id);
    await ctx.http().get('/api/v1/privacy-requests').set(auth(board.token)).expect(403);

    const queue = await ctx
      .http()
      .get('/api/v1/privacy-requests?status=OPEN&pageSize=100')
      .set(auth(admin.token))
      .expect(200);

    expect(queue.body.data.map((r: { id: string }) => r.id)).toContain(first.body.id);

    await ctx
      .http()
      .put(`/api/v1/privacy-requests/${first.body.id}`)
      .set(auth(admin.token))
      .send({ status: 'COMPLETED', resolution: 'Feito' })
      .expect(422);

    const done = await ctx
      .http()
      .post(`/api/v1/privacy-requests/${first.body.id}/anonymize`)
      .set(auth(admin.token))
      .send({ reason: 'Conta anonimizada; pedidos e pagamentos mantidos por obrigação legal.' })
      .expect(200);

    expect(done.body.status).toBe('COMPLETED');

    const anonymized = await ctx.prisma.user.findUniqueOrThrow({ where: { id: subject.id } });

    expect(anonymized.email).not.toBe(subjectRow.email);
    expect(anonymized.name).toBe('Titular anonimizado');
    expect(anonymized.phone).toBeNull();
    await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: subjectRow.email, password: PASSWORD })
      .expect(401);
    await ctx.http().get('/api/v1/me').set(auth(subject.token)).expect(401);

    const post = await ctx.prisma.forumPost.findFirstOrThrow({ where: { topicId: topic.body.id } });

    expect(post.content).not.toContain('99999');
    expect(post.status).toBe('DELETED');

    const privileged = await tokenFor(ctx, ['board']);
    const request2 = await ctx
      .http()
      .post('/api/v1/me/privacy/requests')
      .set(auth(privileged.token))
      .send({ type: 'ERASURE' })
      .expect(201);
    const refused = await ctx
      .http()
      .post(`/api/v1/privacy-requests/${request2.body.id}/anonymize`)
      .set(auth(admin.token))
      .send({ reason: 'Tentativa sobre conta com papel administrativo.' })
      .expect(409);

    expect(refused.body.code).toBe('PRIVILEGED_ACCOUNT');
  });
});
