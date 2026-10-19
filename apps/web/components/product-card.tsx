import Link from 'next/link';

import { formatMoney } from '../lib/format';
import { FULFILLMENT, type ProductSummary } from '../lib/store-types';
import styles from './product-card.module.scss';

export function ProductCard({ product }: { readonly product: ProductSummary }) {
  const onSale = product.priceFrom.amount !== product.listPriceFrom.amount;

  return (
    <Link href={`/loja/${product.slug}`} className={styles.card}>
      <div className={styles.media}>
        {product.image ? (
          <img src={product.image.url} alt={product.image.altText ?? product.name} loading="lazy" />
        ) : (
          <span className={styles.placeholder} aria-hidden="true">
            FÊNIX
          </span>
        )}
        {product.campaign ? <span className={styles.tag}>Pré-venda</span> : null}
        {!product.purchasable ? <span className={styles.soldOut}>Indisponível</span> : null}
      </div>
      <div className={styles.body}>
        <span className={styles.meta}>
          {product.category.name}
          {product.partner ? ` · ${product.partner.name}` : ''}
        </span>
        <strong>{product.name}</strong>
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
