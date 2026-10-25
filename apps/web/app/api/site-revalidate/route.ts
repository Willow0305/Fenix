import { timingSafeEqual } from 'node:crypto';

import { revalidateTag } from 'next/cache';

import { PUBLIC_CONTENT_TAG } from '../../../lib/server-api';

/**
 * Chamado pela API depois de alterações no painel (DT-041): descarta o cache das páginas
 * públicas para a mudança aparecer no próximo carregamento. Protegido por segredo
 * compartilhado; sem SITE_REVALIDATE_SECRET a rota não existe.
 */
export function POST(request: Request): Response {
  const expected = process.env['SITE_REVALIDATE_SECRET'];

  if (!expected) {
    return new Response(null, { status: 404 });
  }

  const received = Buffer.from(request.headers.get('x-revalidate-secret') ?? '');
  const secret = Buffer.from(expected);

  if (received.length !== secret.length || !timingSafeEqual(received, secret)) {
    return new Response(null, { status: 401 });
  }

  revalidateTag(PUBLIC_CONTENT_TAG, { expire: 0 });

  return new Response(null, { status: 204 });
}
