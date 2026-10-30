import Link from 'next/link';

import { Icon } from '../../../components/icon';
import type { Campaign } from '../../../lib/campaign-types';
import { formatDateTime, plural } from '../../../lib/format';

/** Dias inteiros até o fim das vendas, contando o dia de hoje como "último dia". */
export function daysLeft(salesEndAt: string, now = new Date()): number {
  return Math.max(0, Math.ceil((new Date(salesEndAt).getTime() - now.getTime()) / 86_400_000));
}

/**
 * Destaque da pré-venda aberta no topo da loja (Onda 1, docs/31): prazo e mínimo para a
 * encomenda acontecer vêm da remessa, sem número inventado.
 */
export function CampaignHighlight({ campaign }: { readonly campaign: Campaign }) {
  const days = daysLeft(campaign.salesEndAt);
  const minimum = campaign.minimumQuantity;

  return (
    <section className="campaign-highlight" aria-labelledby="pre-venda-destaque">
      <div className="campaign-highlight-text">
        <span className="campaign-highlight-tag">
          <Icon name="clock-history" /> Pré-venda
        </span>
        <h2 id="pre-venda-destaque">{campaign.name}</h2>
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
        <Link href="/loja?prevenda=1" className="btn btn-primary">
          Ver produtos da pré-venda
        </Link>
      </div>
    </section>
  );
}
