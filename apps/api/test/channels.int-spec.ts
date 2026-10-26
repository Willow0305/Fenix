import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AppConfig } from '../src/common/config/app-config';
import { addDays, civilToDate, todayIn } from '../src/common/domain/civil-date';
import { JobScheduler } from '../src/common/jobs/job-scheduler';
import { MailSender } from '../src/common/mail/mail.service';
import { DeliveryError } from '../src/common/messaging/delivery-error';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { WhatsAppSender } from '../src/common/whatsapp/whatsapp.service';
import { FeeRemindersService } from '../src/modules/finance/application/fee-reminders.service';
import { DeliveryService } from '../src/modules/notifications/application/delivery.service';
import { NotificationsService } from '../src/modules/notifications/application/notifications.service';
import { createTestContext, type TestContext, tokenFor } from './helpers';

/** Hora local de hoje em Rio Branco (UTC−5 o ano todo). */
function localInstant(hour: number): Date {
  const [y, m, d] = todayIn().split('-').map(Number) as [number, number, number];

  return new Date(Date.UTC(y, m - 1, d, hour + 5));
}

describe('Avisos por e-mail e WhatsApp (DT-048)', () => {
  let ctx: TestContext;
  let notifications: NotificationsService;
  let delivery: DeliveryService;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestContext();
    notifications = ctx.app.get(NotificationsService);
    delivery = ctx.app.get(DeliveryService);
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  const notify = (userId: string, type: string, key = randomUUID()) =>
    notifications.notify({
      userId,
      type,
      title: 'Pedido 1042: Pronto para retirada',
      message: 'Seu pedido está pronto para retirada.',
      link: '/minha-conta/pedidos/1',
      deduplicationKey: key
    });

  const deliveriesOf = (userId: string) =>
    ctx.prisma.notificationDelivery.findMany({
      where: { notification: { userId } },
      orderBy: { channel: 'asc' }
    });

  const outboxFiles = (dir: string, needle: string) =>
    readdirSync(dir).filter((file) => readFileSync(join(dir, file), 'utf8').includes(needle));

  it('sem escolha registrada, avisa por e-mail e mantém o painel', async () => {
    const user = await tokenFor(ctx, ['user']);
    const { email } = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    await notify(user.id, 'order.status');

    expect((await deliveriesOf(user.id)).map((d) => d.channel)).toEqual(['EMAIL']);

    await delivery.processDue(localInstant(10));

    const [sent] = await deliveriesOf(user.id);

    expect(sent).toMatchObject({ status: 'SENT', attempts: 1, failureCode: null });
    expect(sent?.providerMessageId).toBeTruthy();

    const [file] = outboxFiles(ctx.outboxDir, `To: ${email}`);
    const text = readFileSync(join(ctx.outboxDir, file ?? ''), 'utf8');

    expect(text).toContain('Subject: Pedido 1042: Pronto para retirada — Fênix Vôlei');
    expect(text).toContain('Acesse: http://localhost:3000/minha-conta/pedidos/1');
  });

  it('o mesmo evento não gera outro envio', async () => {
    const user = await tokenFor(ctx, ['user']);
    const key = randomUUID();

    await notify(user.id, 'order.status', key);
    await notify(user.id, 'order.status', key);

    expect(await deliveriesOf(user.id)).toHaveLength(1);
  });

  it('fórum fica só no painel, a menos que a pessoa ligue o e-mail', async () => {
    const user = await tokenFor(ctx, ['user']);

    await notify(user.id, 'forum.reply');
    expect(await deliveriesOf(user.id)).toHaveLength(0);

    await ctx
      .http()
      .put('/api/v1/me/notifications/preferences')
      .set(auth(user.token))
      .send({ items: [{ category: 'COMMUNITY', channel: 'EMAIL', enabled: true }] })
      .expect(200);
    await notify(user.id, 'forum.reply');

    expect(await deliveriesOf(user.id)).toHaveLength(1);
  });

  it('WhatsApp exige celular e consentimento, que fica na auditoria', async () => {
    const user = await tokenFor(ctx, ['user']);
    const consent = (accept: boolean) =>
      ctx
        .http()
        .put('/api/v1/me/notifications/whatsapp-consent')
        .set(auth(user.token))
        .send({ accept });

    const refused = await consent(true).expect(422);

    expect(refused.body.code).toBe('MOBILE_REQUIRED');

    await ctx.prisma.user.update({ where: { id: user.id }, data: { phone: '68999990000' } });

    const accepted = await consent(true).expect(200);

    expect(accepted.body.whatsapp).toMatchObject({
      available: true,
      testMode: true,
      phone: '68999990000'
    });
    expect(accepted.body.whatsapp.consentedAt).toBeTruthy();
    expect(
      await ctx.prisma.auditLog.count({
        where: { entityId: user.id, action: 'notifications.whatsapp_consent.granted' }
      })
    ).toBe(1);

    await notify(user.id, 'order.status');
    expect((await deliveriesOf(user.id)).map((d) => d.channel)).toEqual(['EMAIL', 'WHATSAPP']);

    await delivery.processDue(localInstant(10));

    const sent = await deliveriesOf(user.id);

    expect(sent.map((d) => d.status)).toEqual(['SENT', 'SENT']);

    const [file] = outboxFiles(ctx.whatsappOutboxDir, '5568999990000');
    const message = JSON.parse(readFileSync(join(ctx.whatsappOutboxDir, file ?? ''), 'utf8'));

    expect(message.parameters).toEqual([
      'Pessoa',
      'Pedido 1042: Pronto para retirada',
      'Seu pedido está pronto para retirada.',
      'http://localhost:3000/minha-conta/pedidos/1'
    ]);

    // Retirar o consentimento cancela o que ainda estava na fila.
    await notify(user.id, 'order.status');
    await consent(false).expect(200);

    const after = await ctx.prisma.notificationDelivery.findMany({
      where: { notification: { userId: user.id }, channel: 'WHATSAPP', status: 'CANCELLED' }
    });

    expect(after).toHaveLength(1);
    expect(after[0]?.failureCode).toBe('SEM_CONSENTIMENTO');
  });

  it('WhatsApp à noite espera as 8h sem gastar tentativa', async () => {
    const user = await tokenFor(ctx, ['user']);

    await ctx.prisma.user.update({
      where: { id: user.id },
      data: { phone: '68999990001', whatsappOptInAt: new Date() }
    });
    await notify(user.id, 'order.status');
    await delivery.processDue(localInstant(22));

    const whatsapp = (await deliveriesOf(user.id)).find((d) => d.channel === 'WHATSAPP');

    expect(whatsapp).toMatchObject({ status: 'PENDING', attempts: 0 });
    expect(whatsapp?.nextAttemptAt.getTime()).toBeGreaterThan(localInstant(22).getTime());
  });

  it('confere a preferência de novo na hora do envio', async () => {
    const user = await tokenFor(ctx, ['user']);

    await notify(user.id, 'fee.created');
    await ctx
      .http()
      .put('/api/v1/me/notifications/preferences')
      .set(auth(user.token))
      .send({ items: [{ category: 'FINANCE', channel: 'EMAIL', enabled: false }] })
      .expect(200);
    await delivery.processDue(localInstant(10));

    expect(await deliveriesOf(user.id)).toMatchObject([
      { status: 'CANCELLED', failureCode: 'PREFERENCIA_DESLIGADA' }
    ]);
  });

  it('falha temporária tenta de novo; recusa definitiva para', async () => {
    const mail = ctx.app.get(MailSender);
    const spy = jest
      .spyOn(mail, 'send')
      .mockRejectedValueOnce(new DeliveryError('SMTP_421', false))
      .mockRejectedValueOnce(new DeliveryError('SMTP_RECUSADO', true));
    const temporary = await tokenFor(ctx, ['user']);
    const permanent = await tokenFor(ctx, ['user']);

    try {
      await notify(temporary.id, 'order.status');
      await delivery.processDue(localInstant(10));
      await notify(permanent.id, 'order.status');
      await delivery.processDue(localInstant(10));
    } finally {
      spy.mockRestore();
    }

    const [retry] = await deliveriesOf(temporary.id);

    expect(retry).toMatchObject({ status: 'PENDING', attempts: 1, failureCode: 'SMTP_421' });
    expect(retry?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(await deliveriesOf(permanent.id)).toMatchObject([
      { status: 'FAILED', failureCode: 'SMTP_RECUSADO' }
    ]);
  });

  it('dois processamentos ao mesmo tempo não enviam duas vezes', async () => {
    const user = await tokenFor(ctx, ['user']);
    const { email } = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    // Segundo servidor: outra instância sobre o mesmo banco.
    const other = new DeliveryService(
      ctx.app.get(PrismaService),
      ctx.app.get(AppConfig),
      ctx.app.get(MailSender),
      ctx.app.get(WhatsAppSender),
      ctx.app.get(JobScheduler)
    );
    const spy = jest.spyOn(ctx.app.get(MailSender), 'send');

    try {
      for (let i = 0; i < 5; i += 1) {
        await notify(user.id, 'order.status');
      }

      await Promise.all([
        delivery.processDue(localInstant(10)),
        other.processDue(localInstant(10))
      ]);

      const sent = await deliveriesOf(user.id);

      expect(sent.every((d) => d.status === 'SENT')).toBe(true);
      expect(spy.mock.calls.filter(([message]) => message.to === email)).toHaveLength(5);
    } finally {
      spy.mockRestore();
    }
  });

  it('conta inativa não recebe', async () => {
    const user = await tokenFor(ctx, ['user']);

    await notify(user.id, 'order.status');
    await ctx.prisma.user.update({ where: { id: user.id }, data: { status: 'INACTIVE' } });
    await delivery.processDue(localInstant(10));

    expect(await deliveriesOf(user.id)).toMatchObject([
      { status: 'CANCELLED', failureCode: 'CONTA_INATIVA' }
    ]);
  });

  it('lembra a mensalidade em aberto uma vez por tipo e só em horário comercial', async () => {
    const user = await tokenFor(ctx, ['user']);
    const plan = await ctx.prisma.monthlyFeePlan.create({
      data: { name: `Plano ${randomUUID().slice(0, 6)}`, amount: '80', currency: 'BRL', dueDay: 10 }
    });
    const athlete = await ctx.prisma.athlete.create({
      data: { fullName: 'Atleta Lembrete', status: 'ACTIVE', userId: user.id }
    });
    const today = todayIn();
    const fee = (dueDate: string, status: 'OPEN' | 'PAID', referenceMonth: string) =>
      ctx.prisma.monthlyFee.create({
        data: {
          athleteId: athlete.id,
          monthlyFeePlanId: plan.id,
          referenceMonth: civilToDate(referenceMonth),
          dueDate: civilToDate(dueDate),
          originalAmount: '80',
          totalAmount: '80',
          currency: 'BRL',
          status
        }
      });

    await fee(addDays(today, 3), 'OPEN', '2026-03-01');
    await fee(addDays(today, -7), 'OPEN', '2026-02-01');
    await fee(addDays(today, -1), 'PAID', '2026-01-01');

    const reminders = ctx.app.get(FeeRemindersService);

    expect(await reminders.run(localInstant(22))).toBe(0);

    await reminders.run(localInstant(10));
    await reminders.run(localInstant(11));

    const created = await ctx.prisma.notification.findMany({
      where: { userId: user.id },
      select: { type: true, title: true }
    });

    expect(created.map((n) => n.type).sort()).toEqual([
      'fee.reminder.due-soon',
      'fee.reminder.overdue-7'
    ]);
    expect(created.map((n) => n.title)).toContain('Mensalidade em atraso');
    expect(created.find((n) => n.type === 'fee.reminder.due-soon')?.title).toBe(
      'Mensalidade vence em 3 dias'
    );
    expect((await deliveriesOf(user.id)).map((d) => d.channel)).toEqual(['EMAIL', 'EMAIL']);
  });

  it('a diretoria vê a situação dos envios, sem destinatários', async () => {
    const board = await tokenFor(ctx, ['board']);
    const user = await tokenFor(ctx, ['user']);
    const summary = await ctx
      .http()
      .get('/api/v1/notifications/deliveries/summary')
      .set(auth(board.token))
      .expect(200);

    expect(summary.body).toMatchObject({ email: 'teste', whatsapp: 'teste' });
    expect(summary.body.lastWeek.length).toBeGreaterThan(0);
    expect(JSON.stringify(summary.body)).not.toMatch(/@exemplo\.test|5568/);

    await ctx
      .http()
      .get('/api/v1/notifications/deliveries/summary')
      .set(auth(user.token))
      .expect(403);
  });
});
