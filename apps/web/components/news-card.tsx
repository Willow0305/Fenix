import Link from 'next/link';

import type { NewsSummary } from '../lib/content-types';
import { formatDateTime, formatRelative } from '../lib/format';
import { MediaImage } from './media-image';

/** Data da notícia como no portal ("há 2 horas"), com a data completa para quem passa o mouse. */
export function NewsTime({ iso }: { readonly iso: string | null }) {
  return iso ? (
    <time dateTime={iso} title={formatDateTime(iso)}>
      {formatRelative(iso)}
    </time>
  ) : null;
}

/**
 * Cartão de notícia (docs/29 COR-010): imagem 16:9 sempre presente (capa ou logo Fênix),
 * chapéu da categoria e data, título em até 2 linhas e resumo em até 3. `featured` é a
 * manchete da capa (foto grande ao lado do texto no computador).
 */
export function NewsCard({
  news,
  featured = false,
  headingLevel = 'h2'
}: {
  readonly news: NewsSummary;
  readonly featured?: boolean;
  readonly headingLevel?: 'h2' | 'h3';
}) {
  const Heading = headingLevel;

  return (
    <article className={`content-card${featured ? ' is-featured' : ''}`}>
      <Link href={`/noticias/${news.slug}`} tabIndex={-1} aria-hidden="true">
        <MediaImage src={news.coverUrl} alt="" priority={featured} />
      </Link>
      <div className="content-card-body">
        <small className="news-meta">
          <span className="news-kicker">{news.category.name}</span>
          <NewsTime iso={news.publishedAt} />
        </small>
        <Heading className="content-card-title line-clamp-2" title={news.title}>
          <Link href={`/noticias/${news.slug}`}>{news.title}</Link>
        </Heading>
        {news.summary ? <p className="line-clamp-3">{news.summary}</p> : null}
      </div>
    </article>
  );
}

/** Linha da lista de notícias (capa pequena à esquerda), para ler muitas de uma vez. */
export function NewsRow({
  news,
  headingLevel = 'h3'
}: {
  readonly news: NewsSummary;
  readonly headingLevel?: 'h2' | 'h3';
}) {
  const Heading = headingLevel;

  return (
    <article className="news-row">
      <Link href={`/noticias/${news.slug}`} tabIndex={-1} aria-hidden="true">
        <MediaImage src={news.coverUrl} alt="" />
      </Link>
      <div className="news-row-body">
        <small className="news-meta">
          <span className="news-kicker">{news.category.name}</span>
          <NewsTime iso={news.publishedAt} />
        </small>
        <Heading className="content-card-title line-clamp-2" title={news.title}>
          <Link href={`/noticias/${news.slug}`}>{news.title}</Link>
        </Heading>
        {news.summary ? <p className="line-clamp-2 m-0">{news.summary}</p> : null}
      </div>
    </article>
  );
}
