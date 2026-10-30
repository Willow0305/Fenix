import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Icon } from '../../../../components/icon';
import { JsonLd } from '../../../../components/json-ld';
import { MediaImage } from '../../../../components/media-image';
import { NewsRow, NewsTime } from '../../../../components/news-card';
import { NewsGallery } from '../../../../components/news-gallery';
import { ShareButtons } from '../../../../components/share-buttons';
import type { Page } from '../../../../lib/api-types';
import type { NewsDetail, NewsSummary } from '../../../../lib/content-types';
import { formatDateTime } from '../../../../lib/format';
import { serverGet } from '../../../../lib/server-api';
import { absoluteUrl, newsArticleData } from '../../../../lib/structured-data';

async function load(slug: string): Promise<NewsDetail | null> {
  return serverGet<NewsDetail>(`/public/news/${encodeURIComponent(slug)}`, 30);
}

/** "Leia também": da mesma categoria; se faltar, as mais recentes. Nunca a própria notícia. */
async function related(news: NewsDetail): Promise<NewsSummary[]> {
  const [same, latest] = await Promise.all([
    serverGet<Page<NewsSummary>>(`/public/news?category=${news.category.slug}&pageSize=4`, 60),
    serverGet<Page<NewsSummary>>('/public/news?pageSize=4', 60)
  ]);
  const seen = new Set([news.id]);

  return [...(same?.data ?? []), ...(latest?.data ?? [])]
    .filter((item) => !seen.has(item.id) && seen.add(item.id))
    .slice(0, 3);
}

export async function generateMetadata({
  params
}: {
  readonly params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const news = await load((await params).slug);

  if (news === null) {
    return { title: 'Notícia' };
  }

  const description = news.summary ?? news.content.slice(0, 160);

  return {
    title: news.title,
    description,
    alternates: { canonical: `/noticias/${news.slug}` },
    openGraph: {
      type: 'article',
      title: news.title,
      description,
      ...(news.publishedAt ? { publishedTime: news.publishedAt } : {}),
      section: news.category.name,
      ...(news.coverUrl ? { images: [news.coverUrl] } : {})
    }
  };
}

/** Página de leitura (docs/31, Onda 2): uma coluna, texto em 18 px e "Leia também" no fim. */
export default async function NewsItemPage({
  params
}: {
  readonly params: Promise<{ slug: string }>;
}) {
  const news = await load((await params).slug);

  if (news === null) {
    notFound();
  }

  const more = await related(news);
  // Resposta guardada em cache antes da atualização da API pode chegar sem os campos novos.
  const gallery = (news.gallery as NewsDetail['gallery'] | undefined) ?? [];
  const tags = (news.tags as NewsDetail['tags'] | undefined) ?? [];

  return (
    <article className="container reading">
      <JsonLd data={newsArticleData(news)} />
      <Link href="/noticias" className="back-link">
        <Icon name="arrow-left" /> Notícias
      </Link>
      <header className="reading-header">
        <Link href={`/noticias?categoria=${news.category.slug}`} className="news-kicker">
          {news.category.name}
        </Link>
        <h1>{news.title}</h1>
        {news.summary ? <p className="reading-lede">{news.summary}</p> : null}
        <p className="news-meta m-0">
          {news.authorName ? <span>Por {news.authorName}</span> : null}
          <NewsTime iso={news.publishedAt} />
          {news.publishedAt ? (
            <span className="visually-hidden">({formatDateTime(news.publishedAt)})</span>
          ) : null}
        </p>
        <ShareButtons title={news.title} url={absoluteUrl(`/noticias/${news.slug}`)} />
      </header>
      {/* Sem capa, o texto vem logo abaixo do título (o bloco só com o símbolo não informa nada). */}
      {news.coverUrl ? (
        <MediaImage src={news.coverUrl} alt="" priority className="news-cover" />
      ) : null}
      {/* Texto simples renderizado como texto, nunca como HTML (DT-034). */}
      <div className="prose reading-body">{news.content}</div>
      {gallery.length > 0 ? <NewsGallery images={gallery} /> : null}
      {tags.length > 0 ? (
        <nav aria-label="Assuntos" className="row">
          <span className="muted">Assuntos:</span>
          {tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/noticias?assunto=${tag.slug}`}
              className="btn btn-secondary btn-sm"
            >
              {tag.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {news.event ? (
        <aside className="card row">
          <Icon name="calendar-event" />
          <span>
            Evento relacionado: <Link href={`/eventos/${news.event.slug}`}>{news.event.title}</Link>{' '}
            · {formatDateTime(news.event.startsAt)}
          </span>
        </aside>
      ) : null}
      {more.length > 0 ? (
        <section aria-labelledby="leia-tambem" className="stack reading-more">
          <h2 id="leia-tambem" className="list-title">
            Leia também
          </h2>
          <div>
            {more.map((item) => (
              <NewsRow key={item.id} news={item} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
