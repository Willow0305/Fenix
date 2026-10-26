import { QueryClient } from '@tanstack/react-query';

/** Dados vistos há menos de 30 s aparecem na hora, sem nova busca ao trocar de tela. */
const STALE_MS = 30_000;

/** Status HTTP do erro, se houver (sem importar o cliente da API, para evitar ciclo). */
function statusOf(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;

  return typeof status === 'number' ? status : null;
}

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_MS,
        gcTime: 10 * 60_000,
        // Erro de validação, permissão ou "não encontrado" não melhora repetindo.
        retry: (failures, error) => {
          const status = statusOf(error);

          return failures < 2 && (status === null || status === 0 || status >= 500);
        },
        refetchOnWindowFocus: true
      }
    }
  });
}

let browserClient: QueryClient | null = null;

/**
 * Cache de consultas do painel (R-08, DT-052). No navegador é um só; no servidor, um por
 * renderização, para nunca misturar dados de pessoas diferentes.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return createClient();
  }

  browserClient ??= createClient();

  return browserClient;
}
