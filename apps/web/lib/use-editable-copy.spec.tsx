import { act, renderHook } from '@testing-library/react';

import { useEditableCopy } from './use-editable-copy';

interface Data {
  readonly name: string;
  readonly city: string;
}

const toForm = (data: Data) => ({ name: data.name, city: data.city });

describe('formulário com dados ao vivo (DT-116)', () => {
  it('sem edição pendente, acompanha a versão nova', () => {
    const { result, rerender } = renderHook(({ data }) => useEditableCopy(data, toForm), {
      initialProps: { data: null as Data | null }
    });

    expect(result.current.form).toBeNull();
    rerender({ data: { name: 'Fênix', city: 'Rio Branco' } });
    expect(result.current.form).toEqual({ name: 'Fênix', city: 'Rio Branco' });
    rerender({ data: { name: 'Fênix Vôlei', city: 'Rio Branco' } });
    expect(result.current.form).toEqual({ name: 'Fênix Vôlei', city: 'Rio Branco' });
    expect(result.current.stale).toBe(false);
  });

  it('com edição pendente, mantém o que foi digitado e avisa; descartar traz a versão nova', () => {
    const { result, rerender } = renderHook(({ data }) => useEditableCopy(data, toForm), {
      initialProps: { data: { name: 'Fênix', city: 'Rio Branco' } as Data | null }
    });

    act(() => result.current.setForm({ name: 'Fênix (digitando)', city: 'Rio Branco' }));
    rerender({ data: { name: 'Fênix', city: 'Cruzeiro do Sul' } });

    expect(result.current.form).toEqual({ name: 'Fênix (digitando)', city: 'Rio Branco' });
    expect(result.current.stale).toBe(true);

    act(() => result.current.discard());
    expect(result.current.form).toEqual({ name: 'Fênix', city: 'Cruzeiro do Sul' });
    expect(result.current.stale).toBe(false);
  });

  it('descartar pode ser desfeito até a pessoa voltar a editar', () => {
    const { result, rerender } = renderHook(({ data }) => useEditableCopy(data, toForm), {
      initialProps: { data: { name: 'Fênix', city: 'Rio Branco' } as Data | null }
    });

    act(() => result.current.setForm({ name: 'Meu texto', city: 'Rio Branco' }));
    rerender({ data: { name: 'Fênix', city: 'Cruzeiro do Sul' } });
    act(() => result.current.discard());
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.form).toEqual({ name: 'Meu texto', city: 'Rio Branco' });
    expect(result.current.canUndo).toBe(false);
    // A versão nova continua guardada: o aviso volta e descartar de novo a traz.
    expect(result.current.stale).toBe(true);
    act(() => result.current.discard());
    expect(result.current.form).toEqual({ name: 'Fênix', city: 'Cruzeiro do Sul' });

    act(() => result.current.setForm({ name: 'Outra edição', city: 'Cruzeiro do Sul' }));
    expect(result.current.canUndo).toBe(false);
  });

  it('depois de salvar, a versão nova igual ao formulário encerra a edição', () => {
    const { result, rerender } = renderHook(({ data }) => useEditableCopy(data, toForm), {
      initialProps: { data: { name: 'Fênix', city: 'Rio Branco' } as Data | null }
    });

    act(() => result.current.setForm({ name: 'Fênix Vôlei', city: 'Rio Branco' }));
    rerender({ data: { name: 'Fênix Vôlei', city: 'Rio Branco' } });
    expect(result.current.stale).toBe(false);

    rerender({ data: { name: 'Fênix Vôlei Clube', city: 'Rio Branco' } });
    expect(result.current.form).toEqual({ name: 'Fênix Vôlei Clube', city: 'Rio Branco' });
  });

  it('recarga sem mudança real não marca aviso', () => {
    const { result, rerender } = renderHook(({ data }) => useEditableCopy(data, toForm), {
      initialProps: { data: { name: 'Fênix', city: 'Rio Branco' } as Data | null }
    });

    act(() => result.current.setForm({ name: 'Outro nome', city: 'Rio Branco' }));
    rerender({ data: { name: 'Fênix', city: 'Rio Branco' } });

    expect(result.current.stale).toBe(false);
    expect(result.current.form).toEqual({ name: 'Outro nome', city: 'Rio Branco' });
  });
});
