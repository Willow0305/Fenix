import { render, screen } from '@testing-library/react';

import type { Campaign } from '../../../lib/campaign-types';
import { CampaignHighlight, daysLeft } from './campaign-highlight';

const NOW = new Date('2026-10-29T12:00:00Z');

describe('destaque da pré-venda', () => {
  it('conta os dias que faltam, sem negativo', () => {
    expect(daysLeft('2026-11-08T12:00:00Z', NOW)).toBe(10);
    expect(daysLeft('2026-10-29T18:00:00Z', NOW)).toBe(1);
    expect(daysLeft('2026-10-20T12:00:00Z', NOW)).toBe(0);
  });

  it('mostra o mínimo para a encomenda com os dados da remessa', () => {
    render(
      <CampaignHighlight
        campaign={
          {
            name: 'Uniformes 2027',
            description: null,
            salesEndAt: '2099-01-10T12:00:00Z',
            minimumQuantity: 20,
            paidQuantity: 1
          } as Campaign
        }
      />
    );

    expect(screen.getByRole('heading', { name: 'Uniformes 2027' })).toBeInTheDocument();
    expect(screen.getByText(/1 unidade paga de 20/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver produtos da pré-venda' })).toHaveAttribute(
      'href',
      '/loja?prevenda=1'
    );
  });
});
