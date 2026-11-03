import { act, render, renderHook, screen } from '@testing-library/react';

import { PhoenixLoop, usePhoenixSuccess } from './phoenix-motion';

function mockReducedMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: reduce && query.includes('reduce') })
  });
}

describe('fênix animada (DT-098)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('com movimento reduzido mostra só a logo parada', () => {
    mockReducedMotion(true);
    const { container } = render(<PhoenixLoop fallback={<img alt="Fênix" />} />);

    expect(screen.getByAltText('Fênix')).toBeInTheDocument();
    expect(container.querySelector('video')).toBeNull();
  });

  it('põe o vídeo por cima e volta para a logo se ele não começar a tempo', () => {
    jest.useFakeTimers();
    mockReducedMotion(false);
    const { container } = render(<PhoenixLoop fallback={<img alt="Fênix" />} />);

    expect(container.querySelector('video')).not.toBeNull();
    expect(screen.getByAltText('Fênix')).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(4000));

    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByAltText('Fênix')).toBeInTheDocument();
  });

  it('sem o vídeo de sucesso carregado, entra no sistema na hora', () => {
    mockReducedMotion(false);
    const done = jest.fn();
    const { result } = renderHook(() => usePhoenixSuccess());

    act(() => result.current.celebrate(done));

    expect(done).toHaveBeenCalledTimes(1);
  });

  it('com movimento reduzido não carrega o vídeo de sucesso', () => {
    mockReducedMotion(true);
    const { result } = renderHook(() => usePhoenixSuccess());

    expect(result.current.overlay).toBeNull();
  });
});
