import Link from 'next/link';

import { EventCard } from '../../components/event-card';
import { NewsCard } from '../../components/news-card';
import { ProductCard } from '../../components/product-card';
import type { Page } from '../../lib/api-types';
import type { NewsSummary, TeamEvent } from '../../lib/content-types';
import { serverGet } from '../../lib/server-api';
import type { ProductSummary } from '../../lib/store-types';
import styles from './home.module.scss';

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
        <section className={`container ${styles.section}`} aria-labelledby="noticias">
          <div className={styles.sectionHead}>
            <h2 id="noticias">Notícias</h2>
            <Link href="/noticias">Ver todas</Link>
          </div>
          <div className={styles.grid}>
            {news.data.map((item) => (
              <NewsCard key={item.id} news={item} headingLevel="h3" />
            ))}
          </div>
        </section>
      ) : null}

      {events && events.length > 0 ? (
        <section className={`container ${styles.section}`} aria-labelledby="agenda">
          <div className={styles.sectionHead}>
            <h2 id="agenda">Próximos jogos e eventos</h2>
            <Link href="/eventos">Agenda completa</Link>
          </div>
          <div className={styles.grid}>
            {events.map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        </section>
      ) : null}

      {featured && featured.data.length > 0 ? (
        <section className={`container ${styles.section}`} aria-labelledby="loja-destaques">
          <div className={styles.sectionHead}>
            <h2 id="loja-destaques">Na loja</h2>
            <Link href="/loja">Ver todos os produtos</Link>
          </div>
          <div className={`${styles.grid} ${styles.gridProducts}`}>
            {featured.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
