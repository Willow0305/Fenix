import { act, renderHook } from '@testing-library/react';

import { useUrlFilters } from './use-url-filters';

const replace = jest.fn();
let search = '';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/admin/mensalidades',
  useSearchParams: () => new URLSearchParams(search)
}));

describe('useUrlFilters', () => {
  beforeEach(() => {
    replace.mockClear();
    search = '';
  });

  it('lê os filtros do endereço e conta os ativos', () => {
    search = 'situacao=OPEN&page=3';

    const { result } = renderHook(() => useUrlFilters({ mes: '2026-10', situacao: '' }));

    expect(result.current.values).toEqual({ mes: '2026-10', situacao: 'OPEN' });
    expect(result.current.page).toBe(3);
    expect(result.current.active).toBe(1);
  });

  it('mudar filtro volta para a página 1 e omite valores padrão', () => {
    search = 'page=3';

    const { result } = renderHook(() => useUrlFilters({ mes: '2026-10', situacao: '' }));

    act(() => result.current.set({ situacao: 'PAID' }));
    expect(replace).toHaveBeenCalledWith('/admin/mensalidades?situacao=PAID', { scroll: false });
  });

  it('guarda vazio quando o padrão não é vazio ("Todos os meses")', () => {
    const { result } = renderHook(() => useUrlFilters({ mes: '2026-10', situacao: '' }));

    act(() => result.current.set({ mes: '' }));
    expect(replace).toHaveBeenCalledWith('/admin/mensalidades?mes=', { scroll: false });
  });

  it('limpar volta ao endereço sem filtros', () => {
    search = 'situacao=OPEN';

    const { result } = renderHook(() => useUrlFilters({ mes: '2026-10', situacao: '' }));

    act(() => result.current.clear());
    expect(replace).toHaveBeenCalledWith('/admin/mensalidades', { scroll: false });
  });
});
