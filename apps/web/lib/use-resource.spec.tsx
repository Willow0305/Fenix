import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { resourceKey, useResource } from './use-resource';

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function Teams({ page = 1 }: { readonly page?: number }) {
  const teams = useResource<{ name: string }[]>('/teams', { page, search: '' });

  return <p>{teams.data ? teams.data.map((team) => team.name).join(', ') : 'carregando'}</p>;
}

describe('useResource com cache (DT-052)', () => {
  const fetchMock = jest.fn();
  let client: QueryClient;
  const wrap = (children: ReactNode) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('chave ignora parâmetros vazios e a ordem deles', () => {
    expect(resourceKey('/teams', { b: 2, a: 1, c: '', d: undefined })).toEqual([
      '/teams',
      { a: 1, b: 2 }
    ]);
  });

  it('duas telas que pedem o mesmo recurso fazem uma busca só', async () => {
    fetchMock.mockImplementation(async () => jsonResponse([{ name: 'Sub-17' }]));

    render(
      wrap(
        <>
          <Teams />
          <Teams />
        </>
      )
    );

    expect(await screen.findAllByText('Sub-17')).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('trocar de página mantém a lista anterior até a nova chegar', async () => {
    let release: (() => void) | null = null;

    fetchMock
      .mockImplementationOnce(async () => jsonResponse([{ name: 'Página 1' }]))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            release = () => resolve(jsonResponse([{ name: 'Página 2' }]));
          })
      );

    const { rerender } = render(wrap(<Teams page={1} />));

    await screen.findByText('Página 1');
    rerender(wrap(<Teams page={2} />));
    expect(screen.getByText('Página 1')).toBeInTheDocument();

    await act(async () => release?.());
    await screen.findByText('Página 2');
  });

  it('apagar o cache (logout) não deixa dados da conta anterior', async () => {
    fetchMock.mockImplementation(async () => jsonResponse([{ name: 'Dado privado' }]));

    const { unmount } = render(wrap(<Teams />));

    await screen.findByText('Dado privado');
    unmount();
    client.clear();

    expect(client.getQueryData(resourceKey('/teams', { page: 1 }))).toBeUndefined();
    await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(0));
  });
});
