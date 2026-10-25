import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Icon } from '../../../../components/icon';
import { MediaImage } from '../../../../components/media-image';
import type { NewsDetail } from '../../../../lib/content-types';
import { formatDateTime } from '../../../../lib/format';
import { serverGet } from '../../../../lib/server-api';

async function load(slug: string): Promise<NewsDetail | null> {
  return serverGet<NewsDetail>(`/public/news/${encodeURIComponent(slug)}`, 30);
}

export async function generateMetadata({
  params
}: {
  readonly params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const news = await load((await params).slug);

  return {
    title: news?.title ?? 'Notícia',
    description: news?.summary ?? news?.content.slice(0, 160) ?? undefined,
    ...(news?.coverUrl ? { openGraph: { images: [news.coverUrl] } } : {})
  };
}

export default async function NewsItemPage({
  params
}: {
  readonly params: Promise<{ slug: string }>;
}) {
  const news = await load((await params).slug);

  if (news === null) {
    notFound();
  }

  return (
    <article className="container stack" style={{ paddingTop: '2rem', maxWidth: '50rem' }}>
      <p>
        <Link href="/noticias">
          <Icon name="arrow-left" /> Notícias
        </Link>
      </p>
      <small className="muted">
        {news.category.name} · {formatDateTime(news.publishedAt)}
        {news.authorName ? ` · ${news.authorName}` : ''}
      </small>
      <h1 style={{ margin: 0 }}>{news.title}</h1>
      {news.summary ? <p>{news.summary}</p> : null}
      <MediaImage src={news.coverUrl} alt="" priority className="news-cover" />
      {/* Texto simples renderizado como texto, nunca como HTML (DT-034). */}
      <div className="prose">{news.content}</div>
      {news.event ? (
        <aside className="card">
          <Icon name="calendar-event" /> Evento relacionado:{' '}
          <Link href={`/eventos#${news.event.slug}`}>{news.event.title}</Link> —{' '}
          {formatDateTime(news.event.startsAt)}
        </aside>
      ) : null}
    </article>
  );
}
