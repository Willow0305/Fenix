import Link from 'next/link';

import { ProductCard } from '../../components/product-card';
import type { Page } from '../../lib/api-types';
import { serverGet } from '../../lib/server-api';
import type { ProductSummary } from '../../lib/store-types';

/**
 * Destaques da página inicial. Cada módulo contribui com uma seção quando houver
 * conteúdo publicado; sem conteúdo, a seção não aparece.
 */
export async function HomeHighlights() {
  const featured = await serverGet<Page<ProductSummary>>(
    '/public/products?featured=true&pageSize=4',
    60
  );

  return (
    <>
      {featured && featured.data.length > 0 ? (
        <section
          className="container"
          style={{ paddingTop: '3rem' }}
          aria-labelledby="loja-destaques"
        >
          <div className="row">
            <h2 id="loja-destaques" style={{ margin: 0 }}>
              Na loja
            </h2>
            <span className="spacer" />
            <Link href="/loja">Ver todos os produtos</Link>
          </div>
          <div
            style={{
              display: 'grid',
              gap: '1rem',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              marginTop: '1rem'
            }}
          >
            {featured.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
