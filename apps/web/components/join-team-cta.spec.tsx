import { render, screen } from '@testing-library/react';

import { JoinTeamCta, showJoinInvite } from './join-team-cta';

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
      '/seletivas'
    );
  });
});
