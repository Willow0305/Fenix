import type { Metadata } from 'next';
import Link from 'next/link';

import type { Page } from '../../../lib/api-types';
import type { NewsCategory, NewsSummary } from '../../../lib/content-types';
import { formatDateTime } from '../../../lib/format';
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
        <div className="card">
          <p>Nenhuma notícia publicada.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))'
          }}
        >
          {news.data.map((item) => (
            <article key={item.id} className="card stack">
              {item.coverUrl ? (
                <img
                  src={item.coverUrl}
                  alt=""
                  style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover' }}
                />
              ) : null}
              <small className="muted">
                {item.category.name} · {formatDateTime(item.publishedAt)}
              </small>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                <Link href={`/noticias/${item.slug}`}>{item.title}</Link>
              </h2>
              {item.summary ? <p style={{ margin: 0 }}>{item.summary}</p> : null}
            </article>
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
