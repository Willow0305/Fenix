import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import request from 'supertest';

import { GuestMessagesService } from '../src/modules/store/application/guest-messages.service';
import { createTestContext, login, createUser, type TestContext, tokenFor } from './helpers';

/** 10h no fuso do clube (UTC-5): dentro do horário do WhatsApp. */
const MORNING = new Date(Date.UTC(2026, 10, 3, 15));

/** Avisos do pedido para quem compra sem conta, por e-mail e WhatsApp (DT-096). */
describe('avisos do pedido sem conta', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let messages: GuestMessagesService;
  let categoryId: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    messages = ctx.app.get(GuestMessagesService);
    categoryId = (
      await ctx
        .http()
        .post('/api/v1/store/categories')
        .set(auth(board.token))
        .send({ name: `Avisos ${randomUUID().slice(0, 4)}` })
        .expect(201)
    ).body.id as string;
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  async function variant(): Promise<string> {
    const created = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Garrafa ${randomUUID().slice(0, 6)}`,
        categoryId,
        fulfillmentType: 'STOCK',
        basePrice: '30.00'
      })
      .expect(201);
    const variantId = created.body.variants[0].id as string;

    await ctx
      .http()
      .post(`/api/v1/store/variants/${variantId}/stock`)
      .set(auth(board.token))
      .send({ type: 'STOCK_IN', quantity: 5, reason: 'Entrada inicial' })
      .expect(201);
    await ctx
      .http()
      .put(`/api/v1/store/products/${created.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    return variantId;
  }

  async function checkout(extra: Record<string, unknown>, token?: string) {
    const agent = request.agent(ctx.app.getHttpServer());
    const headers = token ? auth(token) : {};

    await agent
      .put('/api/v1/cart/items')
      .set(headers)
      .send({ variantId: await variant(), quantity: 1 })
      .expect(200);

    return (
      await agent
        .post('/api/v1/orders/checkout')
        .set(headers)
        .send({
          customerName: 'Rita Visitante',
          customerEmail: `rita-${randomUUID().slice(0, 6)}@exemplo.test`,
          customerPhone: '(68) 99999-4321',
          acceptTerms: true,
          ...extra
        })
        .expect(201)
    ).body as { order: { id: string; orderNumber: string }; guestAccessCode: string | null };
  }

  const queued = (orderId: string) =>
    ctx.prisma.guestOrderMessage.findMany({
      where: { orderId },
      orderBy: [{ kind: 'asc' }, { channel: 'asc' }],
      select: { kind: true, channel: true, status: true, failureCode: true }
    });

  it('avisa a compra por e-mail e, com consentimento, por WhatsApp, com o link fixo', async () => {
    const { order, guestAccessCode } = await checkout({ whatsappOptIn: true });

    expect((await queued(order.id)).map((m) => `${m.kind}:${m.channel}`)).toEqual([
      'created:EMAIL',
      'created:WHATSAPP'
    ]);

    await messages.processDue(MORNING);

    const sent = await queued(order.id);

    expect(sent.find((m) => m.channel === 'EMAIL')?.status).toBe('SENT');
    // WhatsApp sai pelo modo de teste ou fica cancelado se o canal estiver desligado.
    expect(['SENT', 'CANCELLED']).toContain(sent.find((m) => m.channel === 'WHATSAPP')?.status);

    const files = readdirSync(ctx.outboxDir).filter((file) =>
      readFileSync(join(ctx.outboxDir, file), 'utf8').includes(order.orderNumber)
    );
    const text = files.map((file) => readFileSync(join(ctx.outboxDir, file), 'utf8')).join('\n');

    expect(text).toContain(
      `/loja/pedido#pedido=${order.orderNumber}&codigo=${guestAccessCode ?? ''}`
    );
    expect(text).toContain(`Código de acesso: ${guestAccessCode ?? ''}`);
  });

  it('avisa pagamento e mudanças de situação; sem consentimento, só por e-mail', async () => {
    const { order } = await checkout({});
    const account = (
      await ctx
        .http()
        .post('/api/v1/finance/accounts')
        .set(auth(board.token))
        .send({ name: `Loja ${randomUUID().slice(0, 6)}`, type: 'BANK' })
        .expect(201)
    ).body.id as string;
    const pix = (await ctx.prisma.paymentMethod.findUniqueOrThrow({ where: { code: 'pix' } })).id;

    await ctx
      .http()
      .post(`/api/v1/store/orders/${order.id}/payments`)
      .set(auth(board.token))
      .set({ 'Idempotency-Key': `test-${randomUUID()}` })
      .send({ paymentMethodId: pix, paidOn: '2026-11-01', accountId: account })
      .expect(201);
    await ctx
      .http()
      .put(`/api/v1/store/orders/${order.id}/status`)
      .set(auth(board.token))
      .send({ status: 'READY_FOR_PICKUP' })
      .expect(200);

    expect((await queued(order.id)).map((m) => `${m.kind}:${m.channel}`)).toEqual([
      'created:EMAIL',
      'paid:EMAIL',
      'status:READY_FOR_PICKUP:EMAIL'
    ]);
  });

  it('quem compra com conta recebe pelos avisos da conta, não pela fila', async () => {
    const user = await createUser(ctx.prisma, ['user']);
    const { order } = await checkout({ whatsappOptIn: true }, await login(ctx, user.email));

    expect(await queued(order.id)).toEqual([]);
  });

  it('"Esqueci o código" reenvia o acesso sem revelar se o e-mail comprou', async () => {
    const email = `esqueci-${randomUUID().slice(0, 6)}@exemplo.test`;
    const { order, guestAccessCode } = await checkout({ customerEmail: email });
    const resend = (address: string) =>
      ctx.http().post('/api/v1/public/orders/resend-access').send({ email: address }).expect(202);
    const known = await resend(email.toUpperCase());
    const unknown = await resend(`ninguem-${randomUUID().slice(0, 6)}@exemplo.test`);

    expect(known.body).toEqual(unknown.body);
    expect(known.body.message).toMatch(/caixa de spam/);

    const today = new Date().toISOString().slice(0, 10);

    await resend(email);
    expect(
      (await queued(order.id)).filter((m) => m.kind === `resend:${today}`).map((m) => m.channel)
    ).toEqual(['EMAIL']);

    await messages.processDue(MORNING);

    const text = readdirSync(ctx.outboxDir)
      .map((file) => readFileSync(join(ctx.outboxDir, file), 'utf8'))
      .filter((content) => content.includes(`Acesso ao pedido ${order.orderNumber}`))
      .join(' ');

    expect(text).toContain(`Código de acesso: ${guestAccessCode ?? ''}`);
    expect(
      await ctx.prisma.auditLog.count({
        where: { entityId: order.id, action: 'order.guest_access.resent' }
      })
    ).toBe(2);
  });

  it('liga e desliga o WhatsApp pela página do pedido, com registro', async () => {
    const { order, guestAccessCode } = await checkout({});
    const toggle = (enabled: boolean, code = guestAccessCode) =>
      ctx
        .http()
        .post('/api/v1/public/orders/whatsapp')
        .send({ orderNumber: order.orderNumber, code, enabled });

    expect((await toggle(true).expect(200)).body.guestWhatsappOptIn).toBe(true);
    await toggle(true, 'ZZZZ-ZZZZ').expect(404);

    await messages.enqueueForOrder(
      ctx.prisma,
      order.id,
      'teste',
      'Pedido: teste',
      'Mensagem de teste.'
    );
    // Sem passar pela fila antes: desligar cancela o que ainda não saiu.
    await ctx.prisma.guestOrderMessage.updateMany({
      where: { orderId: order.id, kind: 'teste' },
      data: { nextAttemptAt: new Date(Date.now() + 3_600_000) }
    });

    expect((await toggle(false).expect(200)).body.guestWhatsappOptIn).toBe(false);
    expect(
      (await queued(order.id)).find((m) => m.kind === 'teste' && m.channel === 'WHATSAPP')
    ).toMatchObject({ status: 'CANCELLED', failureCode: 'CONSENTIMENTO_RETIRADO' });
    expect(
      await ctx.prisma.auditLog.count({
        where: {
          entityId: order.id,
          action: { in: ['order.guest_whatsapp.opt_in', 'order.guest_whatsapp.opt_out'] }
        }
      })
    ).toBe(2);
  });
});
