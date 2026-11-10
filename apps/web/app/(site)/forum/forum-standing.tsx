'use client';

import Link from 'next/link';

import { useAuth } from '../../../lib/auth-context';
import type { ForumStanding } from '../../../lib/content-types';
import { formatDateTime } from '../../../lib/format';
import { useResource } from '../../../lib/use-resource';

/**
 * Aviso para quem está suspenso do fórum (DT-108): até quando, por qual regra e o que pode
 * fazer enquanto isso. Sem suspensão, nada aparece.
 */
export function ForumStandingNotice() {
  const { status } = useAuth();
  const standing = useResource<ForumStanding>(
    status === 'authenticated' ? '/forum/me/standing' : null
  );
  const suspension = standing.data?.suspension;

  if (!suspension) {
    return null;
  }

  return (
    <section className="alert alert-warning stack gap-xs" aria-labelledby="suspensao-forum">
      <strong id="suspensao-forum">
        Você está suspenso do fórum{' '}
        {suspension.until ? `até ${formatDateTime(suspension.until)}` : 'até a diretoria liberar'}
      </strong>
      <span>
        Regra quebrada: {suspension.rule}. {suspension.reason}
      </span>
      <span>
        Enquanto isso, você lê o fórum, mas não publica, responde, edita nem reage.{' '}
        <Link href="/forum/regras">Ler as regras do fórum</Link>
      </span>
    </section>
  );
}
