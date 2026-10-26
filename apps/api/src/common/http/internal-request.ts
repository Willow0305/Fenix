import { timingSafeEqual } from 'node:crypto';

import type { Request } from 'express';

export const INTERNAL_HEADER = 'x-fenix-internal';

/**
 * Leitura feita pelo servidor do site (páginas públicas renderizadas no servidor), com o
 * segredo compartilhado `SITE_REVALIDATE_SECRET` (DT-041, DT-053). Todas saem do mesmo IP;
 * sem esta exceção, o limite por IP bloquearia o próprio site sob tráfego alto.
 */
export function isInternalRequest(
  req: Pick<Request, 'header'>,
  secret: string | undefined = process.env['SITE_REVALIDATE_SECRET']
): boolean {
  const received = req.header(INTERNAL_HEADER);

  if (!secret || !received) {
    return false;
  }

  const a = Buffer.from(received);
  const b = Buffer.from(secret);

  return a.length === b.length && timingSafeEqual(a, b);
}
