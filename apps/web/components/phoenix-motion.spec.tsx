import { act, render, screen } from '@testing-library/react';

import { PhoenixLoop } from './phoenix-motion';

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

    const video = container.querySelector('video');

    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('disablepictureinpicture');
    expect(screen.getByAltText('Fênix')).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(4000));

    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByAltText('Fênix')).toBeInTheDocument();
  });
});
