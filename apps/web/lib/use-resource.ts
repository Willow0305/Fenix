'use client';

import { type QueryKey, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { api, errorMessage, type RequestOptions } from './api-client';
import { onRealtime, shouldReload } from './realtime';

export interface Resource<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly loading: boolean;
  readonly reload: () => Promise<void>;
  readonly setData: (value: T) => void;
  /** Só com `live: 'notify'`: chegou conteúdo novo, que a tela ainda não mostra. */
  readonly hasUpdate: boolean;
}

export interface ResourceOptions {
  /**
   * `auto` (padrão): a tela busca de novo sozinha quando o assunto muda (DT-116).
   * `notify`: em páginas de leitura (fórum), só marca `hasUpdate`; a pessoa decide quando
   * atualizar, para o texto não pular. Depois de uma queda da conexão, busca de novo mesmo assim.
   */
  readonly live?: 'auto' | 'notify';
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
export function useResource<T>(
  path: string | null,
  query?: RequestOptions['query'],
  options: ResourceOptions = {}
): Resource<T> {
  const client = useQueryClient();
  const live = options.live ?? 'auto';
  const [hasUpdate, setHasUpdate] = useState(false);
  const key = path === null ? ['__desligado__'] : resourceKey(path, query);
  const result = useQuery<T>({
    queryKey: key,
    enabled: path !== null,
    meta: { live },
    queryFn: ({ signal }) => api<T>(path ?? '', { query: (key[1] ?? {}) as Query, signal }),
    // Outra página ou filtro do mesmo recurso: mantém a lista na tela, sem piscar.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[0] === path ? previous : undefined
  });
  const serializedKey = JSON.stringify(key);

  useEffect(() => {
    if (live !== 'notify' || path === null) {
      return undefined;
    }

    const cacheKey = JSON.parse(serializedKey) as QueryKey;
    let checking = false;

    // Confere em segundo plano: só avisa se o conteúdo for mesmo diferente do que está na
    // tela (a própria resposta, já recarregada, não conta como novidade).
    return onRealtime((message) => {
      if (message.type !== 'changed' || !shouldReload(path, message) || checking) {
        return;
      }

      checking = true;
      void api<unknown>(path, { query: (cacheKey[1] ?? {}) as Query })
        .then((fresh) => {
          if (JSON.stringify(fresh) !== JSON.stringify(client.getQueryData(cacheKey))) {
            setHasUpdate(true);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          checking = false;
        });
    });
  }, [client, live, path, serializedKey]);

  const reload = useCallback(async () => {
    setHasUpdate(false);

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
    setData,
    hasUpdate
  };
}
