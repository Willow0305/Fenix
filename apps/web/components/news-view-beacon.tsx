'use client';

import { useEffect } from 'react';

/**
 * Conta uma leitura da notícia para "mais lidas" (D5, DT-081). Sem cookie e sem nada que
 * identifique a pessoa: a marca de "já contada" fica só nesta aba (sessionStorage), para
 * recarregar a página não somar de novo. Se o navegador bloquear o armazenamento, conta.
 */
export function NewsViewBeacon({ slug }: { readonly slug: string }) {
  useEffect(() => {
    const key = `fenix:leitura:${slug}`;

    try {
      if (sessionStorage.getItem(key)) {
        return;
      }

      sessionStorage.setItem(key, '1');
    } catch {
      // Armazenamento bloqueado (aba anônima, política do navegador): segue sem a marca.
    }

    void fetch(`/api/v1/public/news/${encodeURIComponent(slug)}/view`, {
      method: 'POST',
      keepalive: true
    }).catch(() => undefined);
  }, [slug]);

  return null;
}
