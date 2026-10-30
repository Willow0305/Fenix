import { createTestContext, PNG_1X1, type TestContext, tokenFor } from './helpers';

/** Fotos do clube na página Sobre (DT-081): envio, ordem, legenda e remoção lógica. */
describe('Fotos do clube (DT-081)', () => {
  let ctx: TestContext;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it('a diretoria envia e ordena; o site público mostra na ordem, sem as removidas', async () => {
    const board = await tokenFor(ctx, ['board']);
    const user = await tokenFor(ctx, ['user']);
    const upload = (token: string, name: string) =>
      ctx
        .http()
        .post('/api/v1/team-settings/photos')
        .set(auth(token))
        .field('altText', `Foto ${name}`)
        .attach('file', PNG_1X1, { filename: `${name}.png`, contentType: 'image/png' });

    await upload(user.token, 'x').expect(403);

    const before = (await ctx.http().get('/api/v1/team-settings').set(auth(board.token))).body as {
      photos: { id: string }[];
    };
    const first = (await upload(board.token, 'a').expect(201)).body as {
      photos: { id: string; altText: string }[];
    };
    const second = (await upload(board.token, 'b').expect(201)).body as {
      photos: { id: string }[];
    };
    const added = second.photos.slice(before.photos.length);
    const [a, b] = added;

    expect(first.photos.at(-1)?.altText).toBe('Foto a');

    const reordered = await ctx
      .http()
      .put('/api/v1/team-settings/photos/order')
      .set(auth(board.token))
      .send({ imageIds: [...before.photos.map((p) => p.id), b?.id, a?.id] })
      .expect(200);

    expect(reordered.body.photos.slice(-2).map((p: { id: string }) => p.id)).toEqual([
      b?.id,
      a?.id
    ]);

    await ctx
      .http()
      .delete(`/api/v1/team-settings/photos/${a?.id}`)
      .set(auth(board.token))
      .expect(200);

    const site = await ctx.http().get('/api/v1/public/team').expect(200);
    const ids = (site.body.photos as { id: string }[]).map((p) => p.id);

    expect(ids).toContain(b?.id);
    expect(ids).not.toContain(a?.id);

    // Não deixa sobra para a próxima execução (limite de 20 fotos).
    await ctx
      .http()
      .delete(`/api/v1/team-settings/photos/${b?.id}`)
      .set(auth(board.token))
      .expect(200);
  });
});
