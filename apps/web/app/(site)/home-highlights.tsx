import Link from 'next/link';

import { ProductCard } from '../../components/product-card';
import type { Page } from '../../lib/api-types';
import { EVENT_TYPE, type NewsSummary, scoreLabel, type TeamEvent } from '../../lib/content-types';
import { formatDateTime } from '../../lib/format';
import { serverGet } from '../../lib/server-api';
import type { ProductSummary } from '../../lib/store-types';

const GRID = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
  marginTop: '1rem'
} as const;

/**
 * Destaques da página inicial. Cada módulo contribui com uma seção quando houver
 * conteúdo publicado; sem conteúdo, a seção não aparece. Notícias vêm do canal
 * "página inicial" da mesma fonte editorial (RF-042, DT-016).
 */
export async function HomeHighlights() {
  const [news, events, featured] = await Promise.all([
    serverGet<Page<NewsSummary>>('/public/news?channel=home&pageSize=3', 30),
    serverGet<TeamEvent[]>('/public/events?scope=upcoming&limit=3', 30),
    serverGet<Page<ProductSummary>>('/public/products?featured=true&pageSize=4', 60)
  ]);

  return (
    <>
      {news && news.data.length > 0 ? (
        <section className="container" style={{ paddingTop: '3rem' }} aria-labelledby="noticias">
          <div className="row">
            <h2 id="noticias" style={{ margin: 0 }}>
              Notícias
            </h2>
            <span className="spacer" />
            <Link href="/noticias">Ver todas</Link>
          </div>
          <div style={GRID}>
            {news.data.map((item) => (
              <article key={item.id} className="card stack">
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt=""
                    style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover' }}
                  />
                ) : null}
                <small className="muted">{formatDateTime(item.publishedAt)}</small>
                <h3 style={{ margin: 0 }}>
                  <Link href={`/noticias/${item.slug}`}>{item.title}</Link>
                </h3>
                {item.summary ? <p style={{ margin: 0 }}>{item.summary}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {events && events.length > 0 ? (
        <section className="container" style={{ paddingTop: '3rem' }} aria-labelledby="agenda">
          <div className="row">
            <h2 id="agenda" style={{ margin: 0 }}>
              Próximos jogos e eventos
            </h2>
            <span className="spacer" />
            <Link href="/eventos">Agenda completa</Link>
          </div>
          <div style={GRID}>
            {events.map((event) => (
              <article key={event.id} className="card stack">
                <span className="badge">{EVENT_TYPE[event.type]}</span>
                <strong>{event.match ? scoreLabel(event.match) : event.title}</strong>
                <span className="muted">
                  {formatDateTime(event.startsAt)}
                  {event.locationName ? ` · ${event.locationName}` : ''}
                </span>
                {event.status === 'CANCELLED' ? (
                  <span className="badge badge-danger">Cancelado</span>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
