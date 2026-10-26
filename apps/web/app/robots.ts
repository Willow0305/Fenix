import type { MetadataRoute } from 'next';

import { SITE_URL } from '../lib/site-url';

/** Busca indexa só o site público; painel, conta e API ficam fora (R-12). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/minha-conta', '/api/', '/loja/carrinho', '/loja/pedido']
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
