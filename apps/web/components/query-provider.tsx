'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';

import { onMutationSuccess } from '../lib/api-client';
import { getQueryClient } from '../lib/query-client';
import { onRealtime, scheduleReload, shouldReload, type RealtimeMessage } from '../lib/realtime';

/**
 * Cache compartilhado das telas (R-08, DT-052). Depois de qualquer alteração, todo o cache
 * fica desatualizado (a próxima tela busca de novo); avisos em tempo real (DT-049) fazem as
 * telas abertas buscarem só o que pode ter mudado.
 */
export function QueryProvider({ children }: { readonly children: ReactNode }) {
  const [client] = useState(getQueryClient);

  useEffect(() => {
    const stopMutations = onMutationSuccess(() => {
      void client.invalidateQueries({ refetchType: 'none' });
    });
    let pending: RealtimeMessage[] = [];
    let cancel: (() => void) | null = null;
    const stopRealtime = onRealtime((message) => {
      pending.push(message);

      if (cancel) {
        return;
      }

      cancel = scheduleReload(() => {
        const messages = pending;

        pending = [];
        cancel = null;
        void client.invalidateQueries({
          predicate: (query) => {
            const path = query.queryKey[0];

            return typeof path === 'string' && messages.some((item) => shouldReload(path, item));
          }
        });
      });
    });

    return () => {
      stopMutations();
      stopRealtime();
      cancel?.();
    };
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
