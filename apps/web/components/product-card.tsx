import Link from 'next/link';

import { formatDate, formatMoney } from '../lib/format';
import { FULFILLMENT, type ProductSummary } from '../lib/store-types';
import { MediaImage } from './media-image';
import styles from './product-card.module.scss';

/** Data civil (fuso do time) de um instante, para "até 20/10". */
function shortDay(iso: string): string {
  return formatDate(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Rio_Branco' }).format(new Date(iso))
  ).slice(0, 5);
}

/**
 * Cartão de produto (docs/29 COR-012/COR-014). Pré-venda aparece como produto normal,
 * só com o selo no canto inferior esquerdo; produto de parceiro mostra a logo dele no canto
 * superior esquerdo; indisponível fica no superior direito.
 */
export function ProductCard({ product }: { readonly product: ProductSummary }) {
  const onSale = product.priceFrom.amount !== product.listPriceFrom.amount;

  return (
    <Link href={`/loja/${product.slug}`} className={styles.card}>
      <MediaImage src={product.image?.url} alt={product.image?.altText ?? product.name} ratio="1/1">
        {product.partner?.logoUrl ? (
          <img
            className="media-seal"
            src={product.partner.logoUrl}
            alt={`Parceiro: ${product.partner.name}`}
            loading="lazy"
          />
        ) : null}
        {product.campaign ? (
          <span className="media-tag">Pré-venda · até {shortDay(product.campaign.salesEndAt)}</span>
        ) : onSale ? (
          <span className="media-tag">Promoção</span>
        ) : null}
        {!product.purchasable ? <span className="media-status">Indisponível</span> : null}
      </MediaImage>
      <div className={styles.body}>
        <span className={styles.meta}>
          {product.category.name}
          {product.partner ? ` · ${product.partner.name}` : ''}
        </span>
        <strong className="line-clamp-2" title={product.name}>
          {product.name}
        </strong>
        <span className={styles.price}>
          {onSale ? <s className="muted">{formatMoney(product.listPriceFrom.amount)}</s> : null}{' '}
          {formatMoney(product.priceFrom.amount)}
        </span>
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          {FULFILLMENT[product.fulfillmentType]}
        </span>
      </div>
    </Link>
  );
}
