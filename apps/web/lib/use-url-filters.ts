'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * Filtros guardados no endereço da página (docs/29 §3.8): o link pode ser compartilhado,
 * o botão Voltar restaura a lista e "Limpar filtros" volta tudo ao padrão.
 * `page` é tratado à parte: qualquer mudança de filtro volta para a página 1.
 */
export function useUrlFilters<K extends string>(defaults: Record<K, string>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const serializedDefaults = JSON.stringify(defaults);

  const values = useMemo(() => {
    const base = JSON.parse(serializedDefaults) as Record<K, string>;

    for (const key of Object.keys(base) as K[]) {
      base[key] = params.get(key) ?? base[key];
    }

    return base;
  }, [params, serializedDefaults]);

  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const base = JSON.parse(serializedDefaults) as Record<K, string>;
  const active = (Object.keys(base) as K[]).filter((key) => values[key] !== base[key]).length;

  const navigate = useCallback(
    (next: Record<string, string>, nextPage: number) => {
      const query = new URLSearchParams();
      const defaultsNow = JSON.parse(serializedDefaults) as Record<string, string>;

      for (const [key, value] of Object.entries(next)) {
        if (value !== '' && value !== defaultsNow[key]) {
          query.set(key, value);
        }
      }

      if (nextPage > 1) {
        query.set('page', String(nextPage));
      }

      const qs = query.toString();

      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, serializedDefaults]
  );

  return {
    values,
    page,
    /** Quantidade de filtros diferentes do padrão. */
    active,
    set: (patch: Partial<Record<K, string>>) => navigate({ ...values, ...patch }, 1),
    setPage: (nextPage: number) => navigate(values, nextPage),
    clear: () => navigate(JSON.parse(serializedDefaults) as Record<K, string>, 1)
  };
}
