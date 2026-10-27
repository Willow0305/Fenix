import { randomUUID } from 'node:crypto';

import { AppConfig } from '../src/common/config/app-config';
import {
  cardKey,
  CARD_WINDOW_MS,
  signLiveToken,
  signPrintedToken
} from '../src/modules/cards/domain/card-token';
import { createTestContext, type TestContext, tokenFor } from './helpers';

describe('Carteirinha digital e benefícios (DT-068)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let holder: { token: string; id: string };
  let athleteId: string;
  let partnerId: string;
  let key: Buffer;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const reason = { reason: 'Conferência de teste' };
  const myCards = async (token = holder.token) =>
    (await ctx.http().get('/api/v1/me/cards').set(auth(token)).expect(200)).body as {
      cards: { id: string; type: string; state: string; benefits: { title: string }[] }[];
    };
  const publicCheck = (token: string) =>
    ctx.http().get(`/api/v1/public/cards/validate/${token}`).expect(200);

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    holder = await tokenFor(ctx, ['user']);
    athleteId = (
      await ctx.prisma.athlete.create({
        data: { fullName: 'Carla Souza Lima', status: 'ACTIVE', userId: holder.id }
      })
    ).id;
    partnerId = (
      await ctx.prisma.partner.create({
        data: {
          legalName: 'Loja Parceira Ltda',
          displayName: `Loja ${randomUUID().slice(0, 4)}`,
          type: 'STORE',
          status: 'ACTIVE'
        }
      })
    ).id;
    key = cardKey(ctx.app.get(AppConfig).values.dataEncryptionKey);
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it('atleta ativo ganha carteirinha com QR que muda a cada minuto', async () => {
    const { cards } = await myCards();
    const card = cards.find((c) => c.type === 'ATHLETE');

    expect(card?.state).toBe('VALID');

    const qr = await ctx
      .http()
      .get(`/api/v1/me/cards/${card?.id ?? ''}/qr`)
      .set(auth(holder.token))
      .expect(200);

    expect(qr.body.qrSvg).toContain('<svg');
    expect(qr.body.refreshInMs).toBeLessThanOrEqual(CARD_WINDOW_MS);

    // Outra conta não acessa a carteirinha.
    const other = await tokenFor(ctx, ['user']);

    await ctx
      .http()
      .get(`/api/v1/me/cards/${card?.id ?? ''}/qr`)
      .set(auth(other.token))
      .expect(404);
  });

  it('benefício: cadastro completo e só aparece valendo, para o público certo', async () => {
    const created = await ctx
      .http()
      .post('/api/v1/partner-benefits')
      .set(auth(board.token))
      .send({
        partnerId,
        title: 'Desconto em calçados',
        discountPercent: '15',
        audience: 'ATHLETES'
      })
      .expect(201);
    const onlyAffiliates = await ctx
      .http()
      .post('/api/v1/partner-benefits')
      .set(auth(board.token))
      .send({ partnerId, title: 'Só afiliados', discountPercent: '5', audience: 'AFFILIATES' })
      .expect(201);

    await ctx
      .http()
      .post('/api/v1/partner-benefits')
      .set(auth(board.token))
      .send({ partnerId, title: 'Inválido', discountPercent: '150', audience: 'BOTH' })
      .expect(422);

    let titles = (await myCards()).cards
      .find((c) => c.type === 'ATHLETE')
      ?.benefits.map((b) => b.title);

    expect(titles).toContain('Desconto em calçados');
    expect(titles).not.toContain('Só afiliados');

    await ctx
      .http()
      .patch(`/api/v1/partner-benefits/${created.body.id}`)
      .set(auth(board.token))
      .send({ isActive: false, discountPercent: '20' })
      .expect(200);
    titles = (await myCards()).cards
      .find((c) => c.type === 'ATHLETE')
      ?.benefits.map((b) => b.title);
    expect(titles).not.toContain('Desconto em calçados');

    await ctx
      .http()
      .delete(`/api/v1/partner-benefits/${onlyAffiliates.body.id}`)
      .set(auth(board.token))
      .send(reason)
      .expect(204);
    await ctx
      .http()
      .patch(`/api/v1/partner-benefits/${created.body.id}`)
      .set(auth(board.token))
      .send({ isActive: true })
      .expect(200);

    const user = await tokenFor(ctx, ['user']);

    await ctx.http().get('/api/v1/partner-benefits').set(auth(user.token)).expect(403);
  });

  it('parceiro confere sem login: nome curto, foto conforme a regra e benefícios', async () => {
    const card = await ctx.prisma.memberCard.findUniqueOrThrow({ where: { athleteId } });
    const ok = await publicCheck(signLiveToken(key, card.id, card.version, new Date()));

    expect(ok.body.valid).toBe(true);
    expect(ok.body.card.name).toBe('Carla L.');
    expect(ok.body.card.benefits.map((b: { title: string }) => b.title)).toContain(
      'Desconto em calçados'
    );
    // Nada de CPF, contato ou mensalidade na resposta pública.
    expect(JSON.stringify(ok.body)).not.toMatch(/email|phone|cpf|fees/i);

    const old = signLiveToken(
      key,
      card.id,
      card.version,
      new Date(Date.now() - 3 * CARD_WINDOW_MS)
    );

    expect((await publicCheck(old)).body.valid).toBe(false);
    expect((await publicCheck('nao-e-carteirinha')).body).toMatchObject({
      valid: false,
      card: null
    });
  });

  it('menor sem autorização do responsável: só o primeiro nome e sem foto', async () => {
    const minorUser = await tokenFor(ctx, ['user']);
    const minor = await ctx.prisma.athlete.create({
      data: {
        fullName: 'Bia Menor Teste',
        status: 'ACTIVE',
        userId: minorUser.id,
        birthDate: new Date('2014-05-01T00:00:00Z')
      }
    });

    await myCards(minorUser.token);

    const card = await ctx.prisma.memberCard.findUniqueOrThrow({ where: { athleteId: minor.id } });
    const res = await publicCheck(signLiveToken(key, card.id, card.version, new Date()));

    expect(res.body.card).toMatchObject({ name: 'Bia', photo: null, minorWithoutPhoto: true });
  });

  it('diretoria suspende, reativa e reemite; o impresso vale até a reemissão', async () => {
    const card = await ctx.prisma.memberCard.findUniqueOrThrow({ where: { athleteId } });
    const printed = signPrintedToken(key, card.id, card.version);
    const act = (action: string) =>
      ctx.http().post(`/api/v1/cards/${card.id}/${action}`).set(auth(board.token)).send(reason);

    expect((await publicCheck(printed)).body.valid).toBe(true);

    await act('suspend').expect(200);

    const suspended = await publicCheck(printed);

    expect(suspended.body).toMatchObject({ valid: false, label: 'Inválida' });
    expect((await myCards()).cards.find((c) => c.id === card.id)?.state).toBe('SUSPENDED');

    await act('reactivate').expect(200);
    await act('reissue').expect(200);
    expect((await publicCheck(printed)).body.valid).toBe(false);
    expect((await publicCheck(signPrintedToken(key, card.id, card.version + 1))).body.valid).toBe(
      true
    );
    await act('explode').expect(400);

    const staff = await ctx
      .http()
      .get(`/api/v1/cards/validate/${signLiveToken(key, card.id, card.version + 1, new Date())}`)
      .set(auth(board.token))
      .expect(200);

    expect(staff.body).toMatchObject({ valid: true, state: 'VALID' });
    expect(staff.body.card.holderName).toBe('Carla Souza Lima');

    const detail = await ctx
      .http()
      .get(`/api/v1/cards/${card.id}`)
      .set(auth(board.token))
      .expect(200);

    expect(detail.body.checks.length).toBeGreaterThanOrEqual(4);
    await ctx.http().get(`/api/v1/cards/validate/x`).set(auth(holder.token)).expect(403);
  });

  it('afiliado: vence na data, liga à conta pelo e-mail e a diretoria estende', async () => {
    const buyer = await tokenFor(ctx, ['user']);
    const beneficiaryEmail = `beneficiario-${randomUUID().slice(0, 6)}@exemplo.test`;
    const card = await ctx.prisma.memberCard.create({
      data: {
        code: `FNX-T${randomUUID().slice(0, 5).toUpperCase()}`,
        type: 'AFFILIATE',
        holderName: 'Rui Afiliado Silva',
        holderEmail: beneficiaryEmail,
        purchasedByUserId: buyer.id,
        startsOn: new Date('2025-01-01T00:00:00Z'),
        endsOn: new Date('2025-12-31T00:00:00Z')
      }
    });

    // Sem conta do beneficiário, aparece para quem comprou.
    const forBuyer = (await myCards(buyer.token)).cards.find((c) => c.id === card.id);

    expect(forBuyer?.state).toBe('EXPIRED');
    expect((await publicCheck(signPrintedToken(key, card.id, 1))).body.label).toBe('Vencida');

    await ctx
      .http()
      .put(`/api/v1/cards/${card.id}/ends-on`)
      .set(auth(board.token))
      .send({ endsOn: '2099-12-31', reason: 'Cortesia por patrocínio' })
      .expect(200);
    expect((await publicCheck(signPrintedToken(key, card.id, 1))).body.valid).toBe(true);

    // Quem confirma o e-mail do beneficiário passa a ver a carteirinha.
    const beneficiary = await tokenFor(ctx, ['user']);

    await ctx.prisma.user.update({
      where: { id: beneficiary.id },
      data: { email: beneficiaryEmail, emailVerifiedAt: new Date() }
    });
    expect((await myCards(beneficiary.token)).cards.map((c) => c.id)).toContain(card.id);
    expect((await myCards(buyer.token)).cards.map((c) => c.id)).not.toContain(card.id);
  });
});
