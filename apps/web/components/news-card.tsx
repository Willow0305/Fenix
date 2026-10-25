import Link from 'next/link';

import type { NewsSummary } from '../lib/content-types';
import { formatDateTime } from '../lib/format';
import { MediaImage } from './media-image';

/**
 * Cartão de notícia (docs/29 COR-010): imagem 16:9 sempre presente (capa ou logo Fênix),
 * categoria e data, título em até 2 linhas e resumo em até 3. `featured` ocupa a linha
 * inteira no computador.
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
        <small className="muted">
          {news.category.name} · {formatDateTime(news.publishedAt)}
        </small>
        <Heading className="content-card-title line-clamp-2" title={news.title}>
          <Link href={`/noticias/${news.slug}`}>{news.title}</Link>
        </Heading>
        {news.summary ? <p className="line-clamp-3">{news.summary}</p> : null}
      </div>
    </article>
  );
}
