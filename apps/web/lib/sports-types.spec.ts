import { tryoutPublicBadge } from './sports-types';

describe('selo público da seletiva', () => {
  it('mostra "abertas" só quando aceita inscrição agora', () => {
    expect(tryoutPublicBadge({ status: 'OPEN', acceptingRegistrations: true }).label).toBe(
      'Inscrições abertas'
    );
  });

  it('não diz "abertas" fora do período ou sem vagas', () => {
    expect(tryoutPublicBadge({ status: 'OPEN', acceptingRegistrations: false })).toEqual({
      label: 'Inscrições fechadas',
      badge: 'badge-warning'
    });
  });

  it('mantém os demais status como no cadastro', () => {
    expect(tryoutPublicBadge({ status: 'CLOSED', acceptingRegistrations: false }).label).toBe(
      'Inscrições encerradas'
    );
    expect(tryoutPublicBadge({ status: 'SCHEDULED', acceptingRegistrations: false }).label).toBe(
      'Agendada'
    );
  });
});
