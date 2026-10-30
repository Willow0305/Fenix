import type { Metadata } from 'next';
import Link from 'next/link';

import { Icon } from '../../../components/icon';
import { NewsCard, NewsRow } from '../../../components/news-card';
import type { Page } from '../../../lib/api-types';
import type { NewsCategory, NewsSummary } from '../../../lib/content-types';
import { serverGet } from '../../../lib/server-api';
import styles from './noticias.module.scss';

export const metadata: Metadata = {
  title: 'Notícias',
  description: 'Notícias do Fênix Vôlei e do vôlei no Acre, no Brasil e no mundo.'
};

/**
 * Capa de notícias em formato de portal (docs/31, Onda 2): na primeira página, a manchete
 * com foto grande, duas secundárias e a lista; nas seguintes, só a lista.
 */
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
  const items = news?.data ?? [];
  const totalPages = news ? Math.ceil(news.meta.total / news.meta.pageSize) : 1;
  const current = categories?.find((category) => category.slug === params.categoria);
  const [lead, ...others] = page === 1 ? items : [];
  const secondary = others.slice(0, 2);
  const rest = page === 1 ? others.slice(2) : items;
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
      <header className="stack gap-sm">
        <h1 className="m-0">{current ? current.name : 'Notícias'}</h1>
        <p className="muted m-0">
          {current?.description ?? 'O Fênix e o vôlei do Acre, do Brasil e do mundo.'}
        </p>
      </header>
      {categories && categories.length > 0 ? (
        <nav aria-label="Categorias" className="row">
          <Link
            href="/noticias"
            className={`btn btn-sm ${params.categoria ? 'btn-secondary' : 'btn-primary'}`}
            aria-current={params.categoria ? undefined : 'page'}
          >
            Todas
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={href({ categoria: category.slug })}
              className={`btn btn-sm ${params.categoria === category.slug ? 'btn-primary' : 'btn-secondary'}`}
              aria-current={params.categoria === category.slug ? 'page' : undefined}
            >
              {category.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {items.length === 0 ? (
        <div className="card empty stack gap-sm">
          <p className="m-0">
            {current
              ? `Nenhuma notícia em ${current.name} por enquanto.`
              : 'Nenhuma notícia publicada por enquanto.'}
          </p>
          {current ? (
            <p className="m-0">
              <Link href="/noticias">Ver todas as notícias</Link>
            </p>
          ) : null}
        </div>
      ) : null}
      {lead ? (
        <section aria-label="Destaques" className={styles.top}>
          <NewsCard news={lead} featured />
          {secondary.map((item) => (
            <NewsCard key={item.id} news={item} />
          ))}
        </section>
      ) : null}
      {rest.length > 0 ? (
        <section aria-labelledby="mais-noticias" className="stack">
          <h2 id="mais-noticias" className={page === 1 ? 'list-title' : 'visually-hidden'}>
            Mais notícias
          </h2>
          <div className={styles.list}>
            {rest.map((item) => (
              <NewsRow key={item.id} news={item} />
            ))}
          </div>
        </section>
      ) : null}
      {totalPages > 1 ? (
        <nav aria-label="Paginação" className="row">
          {page > 1 ? (
            <Link
              href={href({ categoria: params.categoria, pagina: page - 1 })}
              className="back-link"
            >
              <Icon name="chevron-left" /> Mais recentes
            </Link>
          ) : null}
          <span className="muted">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={href({ categoria: params.categoria, pagina: page + 1 })}
              className="back-link"
            >
              Mais antigas <Icon name="chevron-right" />
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
