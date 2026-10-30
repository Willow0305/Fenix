import {
  blankToNull,
  eventDetailsProblems,
  type EventDetails,
  normalizeState
} from './external-events';

const base: EventDetails = {
  isExternal: false,
  organizerName: null,
  officialUrl: null,
  state: null,
  isFree: false,
  ticketPrice: null,
  hasTeamMatch: false,
  hasExternalMatch: false
};

describe('eventos externos (D3, DT-081)', () => {
  it('aceita evento do Fênix sem dados extras', () => {
    expect(eventDetailsProblems(base)).toEqual([]);
  });

  it('exige organizador no evento externo', () => {
    expect(eventDetailsProblems({ ...base, isExternal: true })).toHaveLength(1);
    expect(
      eventDetailsProblems({ ...base, isExternal: true, organizerName: 'Federação Acreana' })
    ).toEqual([]);
  });

  it('aceita só link https e UF da lista', () => {
    expect(eventDetailsProblems({ ...base, officialUrl: 'http://fav.org.br' })).toHaveLength(1);
    expect(eventDetailsProblems({ ...base, officialUrl: 'javascript:alert(1)' })).toHaveLength(1);
    expect(eventDetailsProblems({ ...base, officialUrl: 'https://fav.org.br/agenda' })).toEqual([]);
    expect(eventDetailsProblems({ ...base, state: 'XX' })).toHaveLength(1);
    expect(eventDetailsProblems({ ...base, state: 'AC' })).toEqual([]);
  });

  it('não deixa entrada gratuita com preço', () => {
    expect(eventDetailsProblems({ ...base, isFree: true, ticketPrice: '10.00' })).toHaveLength(1);
  });

  it('separa o jogo do Fênix do jogo entre times de fora', () => {
    expect(
      eventDetailsProblems({ ...base, isExternal: true, organizerName: 'X', hasTeamMatch: true })
    ).toHaveLength(1);
    expect(eventDetailsProblems({ ...base, hasExternalMatch: true })).toHaveLength(1);
  });

  it('normaliza textos opcionais e a UF', () => {
    expect(blankToNull('  ')).toBeNull();
    expect(blankToNull(' Rio Branco ')).toBe('Rio Branco');
    expect(normalizeState(' ac ')).toBe('AC');
    expect(normalizeState('')).toBeNull();
  });
});
