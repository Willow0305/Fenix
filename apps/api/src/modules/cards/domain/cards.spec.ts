import { randomBytes } from 'node:crypto';

import {
  addMonths,
  benefitApplies,
  cardState,
  newCardCode,
  publicStateLabel,
  renewedPeriod,
  shortName
} from './card-rules';
import {
  CARD_WINDOW_MS,
  cardKey,
  signLiveToken,
  signPrintedToken,
  verifyCardToken
} from './card-token';

const key = cardKey(randomBytes(32));
const cardId = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const now = new Date('2026-10-27T15:00:30Z');

describe('código do QR da carteirinha (DT-068)', () => {
  it('assina e confere carteirinha e versão, sem dado pessoal no código', () => {
    const token = signLiveToken(key, cardId, 3, now);

    expect(token).not.toContain(cardId);
    expect(verifyCardToken(key, token, now)).toEqual({ cardId, version: 3, printed: false });
  });

  it('o do celular vale na janela atual e na anterior; print antigo não serve', () => {
    const token = signLiveToken(key, cardId, 1, now);

    expect(verifyCardToken(key, token, new Date(now.getTime() + CARD_WINDOW_MS))).toMatchObject({
      cardId
    });
    expect(verifyCardToken(key, token, new Date(now.getTime() + 2 * CARD_WINDOW_MS))).toEqual({
      error: 'EXPIRED'
    });
    expect(verifyCardToken(key, token, new Date(now.getTime() - CARD_WINDOW_MS))).toEqual({
      error: 'EXPIRED'
    });
  });

  it('o impresso é fixo e não vence com o tempo', () => {
    const token = signPrintedToken(key, cardId, 2);

    expect(verifyCardToken(key, token, new Date('2030-01-01'))).toEqual({
      cardId,
      version: 2,
      printed: true
    });
  });

  it('recusa código alterado, de outra chave ou malformado', () => {
    const parts = signLiveToken(key, cardId, 1, now).split('.');
    const tampered = [parts[0], parts[1], '2', parts[3], parts[4]].join('.');

    expect(verifyCardToken(key, tampered, now)).toEqual({ error: 'SIGNATURE' });
    expect(
      verifyCardToken(cardKey(randomBytes(32)), signPrintedToken(key, cardId, 1), now)
    ).toEqual({ error: 'SIGNATURE' });
    expect(verifyCardToken(key, 'qualquer-coisa', now)).toEqual({ error: 'MALFORMED' });
    expect(verifyCardToken(key, 'p1.x.1.y', now)).toEqual({ error: 'MALFORMED' });
  });
});

describe('situação da carteirinha', () => {
  const base = {
    type: 'AFFILIATE' as const,
    status: 'ACTIVE' as const,
    deleted: false,
    startsOn: '2026-01-01',
    endsOn: '2026-12-31',
    athleteStatus: null
  };

  it('afiliado vale dentro do período; antes não começou; depois venceu', () => {
    expect(cardState(base, '2026-06-01')).toBe('VALID');
    expect(cardState(base, '2025-12-31')).toBe('NOT_STARTED');
    expect(cardState(base, '2027-01-01')).toBe('EXPIRED');
    expect(cardState(base, '2026-12-31')).toBe('VALID');
  });

  it('atleta vale só ativo; suspensão e cancelamento valem para os dois tipos', () => {
    const athlete = { ...base, type: 'ATHLETE' as const, startsOn: null, endsOn: null };

    expect(cardState({ ...athlete, athleteStatus: 'ACTIVE' }, '2026-06-01')).toBe('VALID');
    expect(cardState({ ...athlete, athleteStatus: 'SUSPENDED' }, '2026-06-01')).toBe(
      'ATHLETE_INACTIVE'
    );
    expect(cardState({ ...base, status: 'SUSPENDED' }, '2026-06-01')).toBe('SUSPENDED');
    expect(cardState({ ...base, deleted: true }, '2026-06-01')).toBe('CANCELLED');
  });

  it('quem confere sem login vê só válida, vencida ou inválida', () => {
    expect(publicStateLabel('VALID')).toBe('Válida');
    expect(publicStateLabel('EXPIRED')).toBe('Vencida');
    expect(publicStateLabel('SUSPENDED')).toBe('Inválida');
    expect(publicStateLabel('REPLACED')).toBe('Inválida');
  });
});

describe('apoio', () => {
  it('nome curto e só o primeiro nome', () => {
    expect(shortName('Ana Silva Souza')).toBe('Ana S.');
    expect(shortName('Ana')).toBe('Ana');
    expect(shortName('Ana Silva', true)).toBe('Ana');
  });

  it('número legível sem letras confundíveis', () => {
    expect(newCardCode()).toMatch(/^FNX-[2-9A-HJKMNP-Z]{6}$/);
  });

  it('benefício por público', () => {
    expect(benefitApplies('BOTH', 'ATHLETE')).toBe(true);
    expect(benefitApplies('ATHLETES', 'AFFILIATE')).toBe(false);
    expect(benefitApplies('AFFILIATES', 'AFFILIATE')).toBe(true);
  });

  it('renovação soma ao período que ainda vale; vencida recomeça hoje', () => {
    expect(renewedPeriod('2026-12-31', '2026-12-20', 12)).toEqual({
      startsOn: '2026-12-20',
      endsOn: '2027-12-31'
    });
    expect(renewedPeriod('2026-01-31', '2026-03-10', 1)).toEqual({
      startsOn: '2026-03-10',
      endsOn: '2026-04-10'
    });
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });
});
