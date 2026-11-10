import { render, screen } from '@testing-library/react';

import { JoinTeamCta, joinTeamHref, showJoinInvite } from './join-team-cta';

describe('convite "Quer jogar com a gente?" (DT-091)', () => {
  it('desligado pela diretoria, só aparece com seletiva aberta', () => {
    expect(showJoinInvite(false, 0)).toBe(false);
    expect(showJoinInvite(false, 1)).toBe(true);
    expect(showJoinInvite(true, 0)).toBe(true);
  });

  it('sem a configuração (dados antigos), fica ligado', () => {
    expect(showJoinInvite(undefined, 0)).toBe(true);
  });

  it('com seletiva aberta, leva às inscrições', () => {
    render(<JoinTeamCta openTryouts={2} />);

    expect(screen.getByText(/Há 2 seletivas abertas/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver seletivas abertas' })).toHaveAttribute(
      'href',
      '/eventos#seletivas'
    );
  });

  it('sem seletiva aberta, o botão do Início leva ao convite de Times (PEN-074)', () => {
    expect(joinTeamHref(true, 1)).toBe('/eventos#seletivas');
    expect(joinTeamHref(false, 1)).toBe('/eventos#seletivas');
    expect(joinTeamHref(true, 0)).toBe('/times#quero-jogar');
    expect(joinTeamHref(undefined, 0)).toBe('/times#quero-jogar');
    expect(joinTeamHref(false, 0)).toBe('/interesse');
  });

  it('elenco lotado: sem seletiva aberta, o convite e o botão do Início somem (DT-107)', () => {
    expect(showJoinInvite(true, 0, false)).toBe(false);
    expect(showJoinInvite(true, 1, false)).toBe(true);
    expect(joinTeamHref(true, 0, false)).toBeNull();
    expect(joinTeamHref(true, 2, false)).toBe('/eventos#seletivas');
  });

  it('elenco lotado com seletiva aberta: leva às inscrições, sem "Deixar meu contato"', () => {
    render(<JoinTeamCta openTryouts={1} intakeOpen={false} />);

    expect(screen.getByRole('link', { name: 'Ver seletivas abertas' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Deixar meu contato' })).toBeNull();
  });
});
