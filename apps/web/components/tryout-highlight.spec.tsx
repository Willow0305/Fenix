import { render, screen } from '@testing-library/react';

import type { Tryout } from '../lib/sports-types';
import { stillOpen, TryoutHighlight } from './tryout-highlight';

function tryout(id: string, title: string, extra: Partial<Tryout> = {}): Tryout {
  return {
    id,
    title,
    slug: id,
    description: null,
    location: 'Ginásio do Sesc',
    team: null,
    startsAt: '2099-01-20T13:00:00Z',
    registrationStartsAt: null,
    registrationEndsAt: '2099-01-10T23:59:00Z',
    maxSlots: null,
    usedSlots: 0,
    status: 'OPEN',
    acceptingRegistrations: true,
    blockReason: null,
    cancellationReason: null,
    ...extra
  };
}

beforeEach(() => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }) as unknown as typeof window.matchMedia;
});

describe('seletivas abertas em Eventos (DT-099)', () => {
  it('com uma seletiva, mostra o cartão com inscrição e vagas, sem carrossel', () => {
    render(
      <TryoutHighlight
        tryouts={[tryout('sub-17', 'Seletiva Sub-17', { maxSlots: 30, usedSlots: 12 })]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Seletiva Sub-17' })).toBeInTheDocument();
    expect(screen.getByText('Seletiva aberta')).toBeInTheDocument();
    expect(screen.getByText('18 vagas restantes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inscrever-se' })).toHaveAttribute(
      'href',
      '/seletivas/sub-17'
    );
    expect(screen.queryByRole('button', { name: 'Próxima seletiva' })).not.toBeInTheDocument();
  });

  it('com mais de uma, vira carrossel como a pré-venda', () => {
    render(<TryoutHighlight tryouts={[tryout('a', 'Adulto'), tryout('b', 'Sub-15')]} />);

    expect(screen.getByRole('button', { name: 'Próxima seletiva' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seletiva anterior' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mostrar seletiva 2 de 2: Sub-15' })
    ).toBeInTheDocument();
  });

  it('sem seletiva aberta, nada aparece', () => {
    const { container } = render(<TryoutHighlight tryouts={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('o cartão some quando o prazo de inscrição acaba com a página aberta', () => {
    const now = new Date('2026-11-10T12:00:00Z').getTime();
    const list = [
      tryout('vale', 'Vale', { registrationEndsAt: '2026-11-10T12:00:01Z' }),
      tryout('acabou', 'Acabou', { registrationEndsAt: '2026-11-10T11:59:59Z' }),
      tryout('sem-prazo', 'Sem prazo', { registrationEndsAt: null }),
      tryout('lotada', 'Lotada', { acceptingRegistrations: false })
    ];

    expect(stillOpen(list, now).map((item) => item.id)).toEqual(['vale', 'sem-prazo']);
  });
});
