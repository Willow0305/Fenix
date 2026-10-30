import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMonth,
  formatRelative,
  plural
} from './format';

describe('formatação', () => {
  it('formata data civil sem deslocar o fuso', () => {
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
    expect(formatDate(null)).toBe('—');
  });

  it('formata instantes UTC no fuso do time', () => {
    // 03:00 UTC é 22:00 do dia anterior em America/Rio_Branco (UTC-5).
    expect(formatDateTime('2026-03-02T03:00:00Z')).toBe('01/03/2026, 22:00');
  });

  it('formata dinheiro com moeda explícita', () => {
    expect(formatMoney('89.9').replace(/\s/g, ' ')).toBe('R$ 89,90');
  });

  it('formata o mês de referência', () => {
    expect(formatMonth('2026-07-01')).toBe('07/2026');
  });

  it('escreve o plural por extenso', () => {
    expect(plural(1, 'tópico', 'tópicos')).toBe('1 tópico');
    expect(plural(0, 'tópico', 'tópicos')).toBe('0 tópicos');
    expect(plural(1200, 'pessoa', 'pessoas')).toBe('1.200 pessoas');
  });

  it('escreve a data relativa no fuso do time e passa para a data depois de uma semana', () => {
    // 30/10/2026 12:00 em Rio Branco (UTC-5).
    const now = new Date('2026-10-30T17:00:00Z');

    expect(formatRelative('2026-10-30T16:59:40Z', now)).toBe('agora há pouco');
    expect(formatRelative('2026-10-30T16:15:00Z', now)).toBe('há 45 minutos');
    expect(formatRelative('2026-10-30T14:00:00Z', now)).toBe('há 3 horas');
    expect(formatRelative('2026-10-29T10:00:00Z', now)).toBe('ontem');
    expect(formatRelative('2026-10-27T10:00:00Z', now)).toBe('há 3 dias');
    expect(formatRelative('2026-10-20T10:00:00Z', now)).toBe('20/10/2026');
    expect(formatRelative(null, now)).toBe('—');
  });
});
