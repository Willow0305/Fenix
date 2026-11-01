import { act, fireEvent, render, screen } from '@testing-library/react';

import type { Campaign } from '../../../lib/campaign-types';
import { CampaignHighlight, daysLeft } from './campaign-highlight';

const NOW = new Date('2026-10-29T12:00:00Z');

function campaign(id: string, name: string, extra: Partial<Campaign> = {}): Campaign {
  return {
    id,
    name,
    description: null,
    salesEndAt: '2099-01-10T12:00:00Z',
    minimumQuantity: null,
    paidQuantity: 0,
    ...extra
  } as Campaign;
}

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: reduce,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }) as unknown as typeof window.matchMedia;
}

/** Remessa na tela: a única sem `aria-hidden`. */
function visibleTitle(): string | null {
  return (
    document.querySelector('.campaign-slide:not([aria-hidden="true"]) h2')?.textContent ?? null
  );
}

describe('destaque da pré-venda', () => {
  beforeEach(() => mockReducedMotion(false));

  it('conta os dias que faltam, sem negativo', () => {
    expect(daysLeft('2026-11-08T12:00:00Z', NOW)).toBe(10);
    expect(daysLeft('2026-10-29T18:00:00Z', NOW)).toBe(1);
    expect(daysLeft('2026-10-20T12:00:00Z', NOW)).toBe(0);
  });

  it('mostra o mínimo para a encomenda com os dados da remessa, sem setas com uma só', () => {
    render(
      <CampaignHighlight
        campaigns={[campaign('a', 'Uniformes 2027', { minimumQuantity: 20, paidQuantity: 1 })]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Uniformes 2027' })).toBeInTheDocument();
    expect(screen.getByText(/1 unidade paga de 20/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver produtos da pré-venda' })).toHaveAttribute(
      'href',
      '/loja?prevenda=1'
    );
    expect(screen.queryByRole('button', { name: 'Próxima remessa' })).not.toBeInTheDocument();
  });

  it('não mostra nada sem remessa aberta', () => {
    const { container } = render(<CampaignHighlight campaigns={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('carrossel das pré-vendas (DT-090)', () => {
  const campaigns = [
    campaign('a', 'Uniformes 2027'),
    campaign('b', 'Agasalhos'),
    campaign('c', 'Bonés')
  ];

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('troca sozinha, com uma bolinha por remessa e um único botão', () => {
    mockReducedMotion(false);
    render(<CampaignHighlight campaigns={campaigns} />);

    expect(visibleTitle()).toBe('Uniformes 2027');
    expect(screen.getAllByRole('button', { name: /Mostrar remessa/ })).toHaveLength(3);
    expect(screen.getAllByRole('link', { name: 'Ver produtos da pré-venda' })).toHaveLength(1);

    act(() => jest.advanceTimersByTime(4000));
    expect(visibleTitle()).toBe('Agasalhos');
    expect(screen.getByRole('button', { name: /Mostrar remessa 2 de 3/ })).toHaveAttribute(
      'aria-current',
      'true'
    );
  });

  it('volta e avança pelas setas; voltar da primeira vai para a última', () => {
    mockReducedMotion(false);
    render(<CampaignHighlight campaigns={campaigns} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remessa anterior' }));
    expect(visibleTitle()).toBe('Bonés');
    expect(document.querySelector('.campaign-stage')).toHaveClass('is-back');

    fireEvent.click(screen.getByRole('button', { name: 'Próxima remessa' }));
    expect(visibleTitle()).toBe('Uniformes 2027');
    expect(document.querySelector('.campaign-stage')).not.toHaveClass('is-back');
  });

  it('para de trocar com o mouse em cima e com o foco dentro (WCAG 2.2.2)', () => {
    mockReducedMotion(false);
    render(<CampaignHighlight campaigns={campaigns} />);

    const card = screen.getByRole('region', { name: 'Pré-vendas abertas' });

    fireEvent.pointerEnter(card, { pointerType: 'mouse' });
    act(() => jest.advanceTimersByTime(12000));
    expect(visibleTitle()).toBe('Uniformes 2027');

    fireEvent.pointerLeave(card, { pointerType: 'mouse' });
    fireEvent.focus(screen.getByRole('link', { name: 'Ver produtos da pré-venda' }));
    act(() => jest.advanceTimersByTime(12000));
    expect(visibleTitle()).toBe('Uniformes 2027');
  });

  it('com "reduzir movimento", não troca sozinha', () => {
    mockReducedMotion(true);
    render(<CampaignHighlight campaigns={campaigns} />);

    act(() => jest.advanceTimersByTime(12000));
    expect(visibleTitle()).toBe('Uniformes 2027');

    fireEvent.click(screen.getByRole('button', { name: 'Próxima remessa' }));
    expect(visibleTitle()).toBe('Agasalhos');
  });
});
