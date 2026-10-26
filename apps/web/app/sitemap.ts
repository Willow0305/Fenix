import type { MetadataRoute } from 'next';

import type { Page } from '../lib/api-types';
import { serverGet } from '../lib/server-api';
import { SITE_URL } from '../lib/site-url';

interface Slugged {
  readonly slug: string;
  readonly publishedAt?: string | null;
}

/** Mapa do site para buscadores (R-12): páginas fixas e conteúdo publicado. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [news, products, tryouts, partners] = await Promise.all([
    serverGet<Page<Slugged>>('/public/news?pageSize=100', 3600),
    serverGet<Page<Slugged>>('/public/products?pageSize=100', 3600),
    serverGet<Slugged[]>('/public/tryouts', 3600),
    serverGet<{ id: string }[]>('/public/partners', 3600)
  ]);
  const fixed = [
    '',
    '/sobre',
    '/times',
    '/noticias',
    '/eventos',
    '/seletivas',
    '/loja',
    '/parceiros',
    '/contato',
    '/interesse'
  ];

  return [
    ...fixed.map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: 'weekly' as const })),
    ...(news?.data ?? []).map((item) => ({
      url: `${SITE_URL}/noticias/${item.slug}`,
      ...(item.publishedAt ? { lastModified: item.publishedAt } : {})
    })),
    ...(products?.data ?? []).map((item) => ({ url: `${SITE_URL}/loja/${item.slug}` })),
    ...(tryouts ?? []).map((item) => ({ url: `${SITE_URL}/seletivas/${item.slug}` })),
    ...(partners ?? []).map((item) => ({ url: `${SITE_URL}/parceiros/${item.id}` }))
  ];
}
