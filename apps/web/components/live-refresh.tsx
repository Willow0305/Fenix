'use client';

import type { RealtimeTopic } from '@fenix/validation';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { onRealtime, requirePublicRealtime, scheduleReload } from '../lib/realtime';
import { UpdateBanner } from './update-banner';

/** Assuntos das páginas públicas em cache (os mesmos de `PUBLIC_TOPICS` na API). */
export type LiveTopic = Extract<
  RealtimeTopic,
  | 'teams'
  | 'tryouts'
  | 'store'
  | 'campaigns'
  | 'benefits'
  | 'partners'
  | 'news'
  | 'events'
  | 'settings'
>;

/**
 * Página pública ao vivo (DT-051, DT-116): quando a API avisa que um assunto da página mudou,
 * já com o cache do site descartado, a página busca os dados de novo, sem a pessoa recarregar
 * e mantendo rolagem e campos. Com `notify`, em vez de trocar o conteúdo, mostra "Há
 * novidades" e espera a pessoa pedir, para o texto não pular durante a leitura. Usa a conexão
 * do navegador, dividida entre as abas; sem sessão, liga o fluxo público enquanto aberta.
 */
export function LiveRefresh({
  topics,
  onChange,
  notify = false
}: {
  readonly topics: readonly LiveTopic[];
  /** Padrão: recarrega os dados da página (`router.refresh`), mantendo o que está na tela. */
  readonly onChange?: () => void;
  readonly notify?: boolean;
}) {
  const router = useRouter();
  const handler = useRef(onChange);
  const [news, setNews] = useState(false);
  const key = [...topics].sort().join(',');

  useEffect(() => {
    handler.current = onChange;
  });

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

      if (!relevant) {
        return;
      }

      if (notify && message.type === 'catalog') {
        setNews(true);

        return;
      }

      cancel ??= scheduleReload(() => {
        cancel = null;
        (handler.current ?? (() => router.refresh()))();
      }, 400);
    });

    return () => {
      stop();
      release();
      cancel?.();
    };
  }, [key, notify, router]);

  if (!notify) {
    return null;
  }

  return (
    <UpdateBanner
      visible={news}
      onApply={() => {
        setNews(false);
        (handler.current ?? (() => router.refresh()))();
      }}
    />
  );
}
