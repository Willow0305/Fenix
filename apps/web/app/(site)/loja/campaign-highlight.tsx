'use client';

import Link from 'next/link';

import { HighlightCarousel } from '../../../components/highlight-carousel';
import { Icon } from '../../../components/icon';
import type { Campaign } from '../../../lib/campaign-types';
import { daysLeft, formatDateTime, plural } from '../../../lib/format';

export { daysLeft } from '../../../lib/format';

function CampaignSlide({ campaign, titleId }: { campaign: Campaign; titleId: string }) {
  const days = daysLeft(campaign.salesEndAt);
  const minimum = campaign.minimumQuantity;

  return (
    <>
      <div className="campaign-highlight-text">
        <span className="campaign-highlight-tag">
          <Icon name="clock-history" /> Pré-venda
        </span>
        <h2 id={titleId}>{campaign.name}</h2>
        {campaign.description ? <p>{campaign.description}</p> : null}
        <p className="campaign-highlight-deadline">
          {days <= 1
            ? `Último dia: vendas até ${formatDateTime(campaign.salesEndAt)}`
            : `Faltam ${plural(days, 'dia', 'dias')}: vendas até ${formatDateTime(campaign.salesEndAt)}`}
        </p>
      </div>
      <div className="campaign-highlight-side">
        {minimum ? (
          <div className="campaign-progress">
            <span>
              {plural(campaign.paidQuantity, 'unidade paga', 'unidades pagas')} de {minimum} para a
              encomenda acontecer
            </span>
            <progress value={Math.min(campaign.paidQuantity, minimum)} max={minimum} />
          </div>
        ) : null}
      </div>
    </>
  );
}

/**
 * Destaque das pré-vendas abertas no topo da loja (Onda 1, docs/31; carrossel DT-090): uma
 * remessa por vez, com prazo e mínimo vindos da remessa. O carrossel é o mesmo das seletivas
 * em Eventos (`HighlightCarousel`). O botão fica parado: só o conteúdo da remessa troca.
 */
export function CampaignHighlight({ campaigns }: { readonly campaigns: readonly Campaign[] }) {
  return (
    <HighlightCarousel
      items={campaigns}
      idPrefix="pre-venda-destaque"
      labels={{ region: 'Pré-vendas abertas', item: 'remessa' }}
      itemName={(campaign) => campaign.name}
      renderSlide={(campaign, titleId) => <CampaignSlide campaign={campaign} titleId={titleId} />}
      action={
        <Link href="/loja?prevenda=1" className="btn btn-primary">
          Ver produtos da pré-venda
        </Link>
      }
    />
  );
}
