import type { Metadata } from 'next';
import Link from 'next/link';

import { ProductCard } from '../../../components/product-card';
import type { Page } from '../../../lib/api-types';
import { serverGet } from '../../../lib/server-api';
import type { ProductSummary, StoreCategory } from '../../../lib/store-types';
import { StoreToolbar } from './store-toolbar';

export const metadata: Metadata = { title: 'Loja' };

export default async function StorePage({
  searchParams
}: {
  readonly searchParams: Promise<{ categoria?: string; busca?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.pagina ?? 1) || 1);
  const query = new URLSearchParams({ page: String(page), pageSize: '24' });

  if (params.categoria) {
    query.set('category', params.categoria);
  }

  if (params.busca) {
    query.set('search', params.busca);
  }

  const [products, categories] = await Promise.all([
    serverGet<Page<ProductSummary>>(`/public/products?${query.toString()}`, 30),
    serverGet<StoreCategory[]>('/public/product-categories', 60)
  ]);
  const totalPages = products ? Math.ceil(products.meta.total / products.meta.pageSize) : 1;
  const link = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { categoria: params.categoria, busca: params.busca, ...overrides };

    for (const [k, v] of Object.entries(merged)) {
      if (v) {
        next.set(k, v);
      }
    }

    return `/loja${next.size ? `?${next.toString()}` : ''}`;
  };

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      <div className="page-header">
        <div>
          <h1>Loja oficial</h1>
          <p>Uniformes, acessórios e produtos de parceiros do Fênix.</p>
        </div>
        <StoreToolbar />
      </div>
      <nav aria-label="Categorias" className="row">
        <Link
          href={link({ categoria: undefined, pagina: undefined })}
          className={`btn btn-sm ${params.categoria ? 'btn-secondary' : 'btn-primary'}`}
        >
          Todas
        </Link>
        {(categories ?? []).map((category) => (
          <Link
            key={category.id}
            href={link({ categoria: category.slug, pagina: undefined })}
            className={`btn btn-sm ${params.categoria === category.slug ? 'btn-primary' : 'btn-secondary'}`}
          >
            {category.name}
          </Link>
        ))}
      </nav>
      <form className="row" role="search" action="/loja">
        {params.categoria ? (
          <input type="hidden" name="categoria" value={params.categoria} />
        ) : null}
        <input
          name="busca"
          defaultValue={params.busca ?? ''}
          aria-label="Buscar produtos"
          placeholder="Buscar produtos"
          style={{
            minHeight: 44,
            padding: '0 0.75rem',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            flex: 1,
            maxWidth: 420
          }}
        />
        <button type="submit" className="btn btn-secondary">
          Buscar
        </button>
      </form>
      {products === null ? (
        <p className="empty">A loja está indisponível no momento. Tente novamente em instantes.</p>
      ) : products.data.length === 0 ? (
        <p className="empty">
          {params.busca || params.categoria
            ? 'Nenhum produto encontrado para o filtro.'
            : 'Novos produtos em breve!'}
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))'
          }}
        >
          {products.data.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
      {totalPages > 1 ? (
        <nav aria-label="Paginação" className="row">
          {page > 1 ? <Link href={link({ pagina: String(page - 1) })}>Anterior</Link> : null}
          <span>
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={link({ pagina: String(page + 1) })}>Próxima</Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
