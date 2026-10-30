import { randomUUID } from 'node:crypto';

import { createTestContext, type TestContext, tokenFor } from './helpers';

/**
 * Eventos externos na agenda (D3, DT-081): organizador e link oficial, cidade livre com UF,
 * entrada gratuita ou com preço, jogo entre times de fora e filtro "Acre / outros lugares".
 */
describe('Eventos externos (D3, DT-081)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  const tag = randomUUID().slice(0, 6);
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const inDays = (days: number) => new Date(Date.now() + days * 24 * 3_600_000).toISOString();
  const create = (body: Record<string, unknown>) =>
    ctx.http().post('/api/v1/events').set(auth(board.token)).send(body);
  const schedule = (id: string) =>
    ctx
      .http()
      .put(`/api/v1/events/${id}/status`)
      .set(auth(board.token))
      .send({ status: 'SCHEDULED' })
      .expect(200);
  const publicIds = async (query: string) =>
    (
      (await ctx.http().get(`/api/v1/public/events?${query}`).expect(200)).body as {
        id: string;
      }[]
    ).map((event) => event.id);

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it('valida organizador, link https, UF e entrada', async () => {
    const base = { title: `Estadual ${tag}`, type: 'MATCH', startsAt: inDays(3) };

    await create({ ...base, isExternal: true }).expect(422);
    await create({
      ...base,
      isExternal: true,
      organizerName: 'FAV',
      officialUrl: 'http://x.org'
    }).expect(422);
    await create({ ...base, isExternal: true, organizerName: 'FAV', state: 'XX' }).expect(422);
    await create({
      ...base,
      isExternal: true,
      organizerName: 'FAV',
      isFree: true,
      ticketPrice: '10.00'
    }).expect(422);
    await create({
      ...base,
      isExternal: true,
      organizerName: 'FAV',
      match: { opponentName: 'Águias' }
    }).expect(422);
  });

  it('publica o evento externo com times, placar e preço, e filtra por lugar e origem', async () => {
    const acre = await create({
      title: `Final estadual ${tag}`,
      type: 'MATCH',
      startsAt: inDays(4),
      isPublic: true,
      isExternal: true,
      organizerName: 'Federação Acreana de Voleibol',
      officialUrl: 'https://fav.example/final',
      city: 'Cruzeiro do Sul',
      state: 'ac',
      ticketPrice: '15.50',
      externalMatch: { homeTeamName: 'Águias', awayTeamName: 'Leões', competitionName: 'Estadual' }
    }).expect(201);
    const abroad = await create({
      title: `Mundial ${tag}`,
      type: 'OTHER',
      startsAt: inDays(5),
      isPublic: true,
      isExternal: true,
      organizerName: 'FIVB',
      city: 'Lima (Peru)',
      isFree: true
    }).expect(201);
    const home = await create({
      title: `Treino aberto ${tag}`,
      type: 'COMMUNITY',
      startsAt: inDays(6),
      isPublic: true
    }).expect(201);

    expect(acre.body).toMatchObject({
      isExternal: true,
      state: 'AC',
      admission: { isFree: false, price: { amount: '15.50', currency: 'BRL' } },
      externalMatch: { homeTeamName: 'Águias', awayTeamName: 'Leões', homeScore: null }
    });

    for (const event of [acre, abroad, home]) {
      await schedule(event.body.id as string);
    }

    const inAcre = await publicIds('region=acre');
    const elsewhere = await publicIds('region=outros');
    const external = await publicIds('origin=external');
    const fenix = await publicIds('origin=fenix');

    expect(inAcre).toContain(acre.body.id);
    expect(inAcre).not.toContain(abroad.body.id);
    expect(elsewhere).toContain(abroad.body.id);
    expect(elsewhere).not.toContain(acre.body.id);
    // Sem cidade nem UF, o evento só aparece em "todos".
    expect(elsewhere).not.toContain(home.body.id);
    expect(external).toEqual(expect.arrayContaining([acre.body.id, abroad.body.id]));
    expect(external).not.toContain(home.body.id);
    expect(fenix).toContain(home.body.id);

    const scored = await ctx
      .http()
      .patch(`/api/v1/events/${acre.body.id}`)
      .set(auth(board.token))
      .send({
        ticketPrice: '',
        isFree: true,
        externalMatch: { homeTeamName: 'Águias', awayTeamName: 'Leões', homeScore: 3, awayScore: 2 }
      })
      .expect(200);

    expect(scored.body).toMatchObject({
      admission: { isFree: true, price: null },
      externalMatch: { homeScore: 3, awayScore: 2 }
    });

    const removed = await ctx
      .http()
      .patch(`/api/v1/events/${acre.body.id}`)
      .set(auth(board.token))
      .send({ externalMatch: null })
      .expect(200);

    expect(removed.body.externalMatch).toBeNull();
  });
});
