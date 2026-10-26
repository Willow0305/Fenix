'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { api, errorMessage, type RequestOptions } from './api-client';
import { onRealtime, scheduleReload, shouldReload } from './realtime';

export interface Resource<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly loading: boolean;
  readonly reload: () => Promise<void>;
  readonly setData: (value: T) => void;
}

/** Carrega um recurso da API e recarrega quando o caminho ou a query mudam. */
export function useResource<T>(path: string | null, query?: RequestOptions['query']): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const serializedQuery = JSON.stringify(query ?? {});
  const sequence = useRef(0);

  const reload = useCallback(async () => {
    if (path === null) {
      return;
    }

    const current = ++sequence.current;

    setLoading(true);
    setError(null);

    try {
      const result = await api<T>(path, {
        query: JSON.parse(serializedQuery) as NonNullable<RequestOptions['query']>
      });

      if (current === sequence.current) {
        setData(result);
      }
    } catch (caught) {
      if (current === sequence.current) {
        setError(errorMessage(caught));
      }
    } finally {
      if (current === sequence.current) {
        setLoading(false);
      }
    }
  }, [path, serializedQuery]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Tempo real (DT-049): busca de novo quando algo que a tela mostra pode ter mudado.
  useEffect(() => {
    if (path === null) {
      return undefined;
    }

    let cancelPending: (() => void) | null = null;
    const unsubscribe = onRealtime((message) => {
      if (cancelPending || !shouldReload(path, message)) {
        return;
      }

      cancelPending = scheduleReload(() => {
        cancelPending = null;
        void reload();
      });
    });

    return () => {
      unsubscribe();
      cancelPending?.();
    };
  }, [path, reload]);

  return { data, error, loading, reload, setData };
}
