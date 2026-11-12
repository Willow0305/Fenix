'use client';

import type { RealtimeTopic } from '@fenix/validation';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { onRealtime, requirePublicRealtime, scheduleReload } from '../lib/realtime';

export type LiveTopic = Extract<RealtimeTopic, 'store' | 'tryouts'>;

/**
 * Página pública ao vivo (DT-051, DT-116): quando a API avisa que a loja (estoque, preço) ou
 * as seletivas (vagas) mudaram, já com o cache do site descartado, a página busca os dados de
 * novo, sem a pessoa recarregar. Usa a conexão do navegador, dividida entre as abas; sem
 * sessão, liga o fluxo público enquanto a página estiver aberta.
 */
export function LiveRefresh({
  topics,
  onChange
}: {
  readonly topics: readonly LiveTopic[];
  /** Padrão: recarrega os dados da página (`router.refresh`), mantendo o que está na tela. */
  readonly onChange?: () => void;
}) {
  const router = useRouter();
  const handler = useRef(onChange);
  const key = [...topics].sort().join(',');

  handler.current = onChange;

  useEffect(() => {
    if (key === '') {
      return undefined;
    }

    const wanted = key.split(',');
    const release = requirePublicRealtime();
    let cancel: (() => void) | null = null;
    const stop = onRealtime((message) => {
      const relevant =
        message.type === 'resync' ||
        (message.type === 'catalog' && message.topics.some((topic) => wanted.includes(topic)));

      if (!relevant || cancel) {
        return;
      }

      cancel = scheduleReload(() => {
        cancel = null;
        (handler.current ?? (() => router.refresh()))();
      }, 400);
    });

    return () => {
      stop();
      release();
      cancel?.();
    };
  }, [key, router]);

  return null;
}
