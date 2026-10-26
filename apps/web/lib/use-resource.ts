'use client';

import { type QueryKey, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { api, errorMessage, type RequestOptions } from './api-client';

export interface Resource<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly loading: boolean;
  readonly reload: () => Promise<void>;
  readonly setData: (value: T) => void;
}

type Query = NonNullable<RequestOptions['query']>;

/** Chave do cache: caminho e parâmetros (vazios não contam), sempre na mesma ordem. */
export function resourceKey(path: string, query?: RequestOptions['query']): QueryKey {
  const params = Object.entries(query ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b));

  return [path, Object.fromEntries(params)];
}

/**
 * Carrega um recurso da API com cache compartilhado (R-08, DT-052). Telas que pedem o mesmo
 * recurso dividem uma única busca; voltar a uma tela mostra os dados na hora e atualiza em
 * seguida. Mudar só a página ou o filtro mantém a lista anterior até a nova chegar.
 */
export function useResource<T>(path: string | null, query?: RequestOptions['query']): Resource<T> {
  const client = useQueryClient();
  const key = path === null ? ['__desligado__'] : resourceKey(path, query);
  const result = useQuery<T>({
    queryKey: key,
    enabled: path !== null,
    queryFn: ({ signal }) => api<T>(path ?? '', { query: (key[1] ?? {}) as Query, signal }),
    // Outra página ou filtro do mesmo recurso: mantém a lista na tela, sem piscar.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[0] === path ? previous : undefined
  });
  const serializedKey = JSON.stringify(key);

  const reload = useCallback(async () => {
    if (path !== null) {
      await client.refetchQueries({ queryKey: JSON.parse(serializedKey) as QueryKey, exact: true });
    }
  }, [client, path, serializedKey]);

  const setData = useCallback(
    (value: T) => client.setQueryData(JSON.parse(serializedKey) as QueryKey, value),
    [client, serializedKey]
  );

  return {
    data: result.data ?? null,
    error: result.error ? errorMessage(result.error) : null,
    loading: path !== null && result.isFetching,
    reload,
    setData
  };
}
