import { randomUUID } from 'node:crypto';

import { NotificationsService } from '../src/modules/notifications/application/notifications.service';
import { createTestContext, type TestContext, tokenFor } from './helpers';

describe('Apagar notificações', () => {
  let ctx: TestContext;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  const notify = (userId: string) =>
    ctx.app.get(NotificationsService).notify({
      userId,
      type: 'announcement',
      title: 'Aviso',
      message: 'Texto do aviso.',
      deduplicationKey: randomUUID()
    });

  const list = async (token: string) =>
    (await ctx.http().get('/api/v1/me/notifications').set(auth(token)).expect(200)).body.data as {
      id: string;
      readAt: string | null;
    }[];

  it('apaga a própria notificação (exclusão lógica)', async () => {
    const user = await tokenFor(ctx, ['user']);

    await notify(user.id);

    const [item] = await list(user.token);

    await ctx
      .http()
      .delete(`/api/v1/me/notifications/${item?.id ?? ''}`)
      .set(auth(user.token))
      .expect(204);

    expect(await list(user.token)).toHaveLength(0);
    expect(
      await ctx.prisma.notification.count({
        where: { id: item?.id ?? '', deletedAt: { not: null } }
      })
    ).toBe(1);
  });

  it('não apaga notificação de outra pessoa', async () => {
    const owner = await tokenFor(ctx, ['user']);
    const other = await tokenFor(ctx, ['user']);

    await notify(owner.id);

    const [item] = await list(owner.token);

    await ctx
      .http()
      .delete(`/api/v1/me/notifications/${item?.id ?? ''}`)
      .set(auth(other.token))
      .expect(404);
    expect(await list(owner.token)).toHaveLength(1);
  });

  it('"apagar as lidas" mantém as novas', async () => {
    const user = await tokenFor(ctx, ['user']);

    await notify(user.id);
    await notify(user.id);

    const [first] = await list(user.token);

    await ctx
      .http()
      .post(`/api/v1/me/notifications/${first?.id ?? ''}/read`)
      .set(auth(user.token))
      .expect(204);

    const removed = await ctx
      .http()
      .delete('/api/v1/me/notifications/read')
      .set(auth(user.token))
      .expect(200);

    expect(removed.body).toEqual({ removed: 1 });
    expect((await list(user.token)).map((item) => item.readAt)).toEqual([null]);
  });
});
