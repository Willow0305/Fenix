'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { scheduleReload } from '../lib/realtime';

export type LiveTopic = 'store' | 'tryouts';

/**
 * Página pública ao vivo (DT-051): quando a API avisa que a loja (estoque, preço) ou as
 * seletivas (vagas) mudaram, a página busca os dados de novo, sem a pessoa recarregar.
 * Sem login; usa o `EventSource` do navegador, que reconecta sozinho.
 */
export function LiveRefresh({
  topics,
  onChange
}: {
  readonly topics: readonly LiveTopic[];
  /** Padrão: recarrega os dados da página (`router.refresh`). */
  readonly onChange?: () => void;
}) {
  const router = useRouter();
  const handler = useRef(onChange);
  const key = [...topics].sort().join(',');

  handler.current = onChange;

  useEffect(() => {
    if (typeof EventSource === 'undefined' || key === '') {
      return undefined;
    }

    const source = new EventSource(`/api/v1/public/live?topics=${encodeURIComponent(key)}`);
    let cancel: (() => void) | null = null;

    source.addEventListener('catalog', () => {
      if (cancel) {
        return;
      }

      cancel = scheduleReload(() => {
        cancel = null;
        (handler.current ?? (() => router.refresh()))();
      }, 400);
    });

    return () => {
      source.close();
      cancel?.();
    };
  }, [key, router]);

  return null;
}
