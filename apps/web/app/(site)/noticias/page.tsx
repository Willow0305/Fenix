import type { Metadata } from 'next';
import Link from 'next/link';

import { NewsCard } from '../../../components/news-card';
import type { Page } from '../../../lib/api-types';
import type { NewsCategory, NewsSummary } from '../../../lib/content-types';
import { serverGet } from '../../../lib/server-api';

export const metadata: Metadata = { title: 'Notícias' };

export default async function NewsPage({
  searchParams
}: {
  readonly searchParams: Promise<{ categoria?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.pagina ?? 1) || 1);
  const query = new URLSearchParams({ page: String(page), pageSize: '12' });

  if (params.categoria) {
    query.set('category', params.categoria);
  }

  const [news, categories] = await Promise.all([
    serverGet<Page<NewsSummary>>(`/public/news?${query.toString()}`, 30),
    serverGet<NewsCategory[]>('/public/news-categories', 60)
  ]);
  const totalPages = news ? Math.ceil(news.meta.total / news.meta.pageSize) : 1;
  const href = (next: { categoria?: string | undefined; pagina?: number }) => {
    const qs = new URLSearchParams();

    if (next.categoria) {
      qs.set('categoria', next.categoria);
    }

    if (next.pagina && next.pagina > 1) {
      qs.set('pagina', String(next.pagina));
    }

    return `/noticias${qs.size ? `?${qs.toString()}` : ''}`;
  };

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      <h1>Notícias</h1>
      {categories && categories.length > 0 ? (
        <nav aria-label="Categorias" className="row">
          <Link href="/noticias" aria-current={params.categoria ? undefined : 'page'}>
            Todas
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={href({ categoria: category.slug })}
              aria-current={params.categoria === category.slug ? 'page' : undefined}
            >
              {category.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {!news || news.data.length === 0 ? (
        <div className="card empty">
          <p>Nenhuma notícia publicada por enquanto.</p>
        </div>
      ) : (
        <div className="card-grid" style={{ '--card-min': '300px' } as React.CSSProperties}>
          {news.data.map((item, index) => (
            <NewsCard key={item.id} news={item} featured={page === 1 && index === 0} />
          ))}
        </div>
      )}
      {totalPages > 1 ? (
        <nav aria-label="Paginação" className="row">
          {page > 1 ? (
            <Link href={href({ categoria: params.categoria, pagina: page - 1 })}>← Anteriores</Link>
          ) : null}
          <span className="muted">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={href({ categoria: params.categoria, pagina: page + 1 })}>Próximas →</Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
