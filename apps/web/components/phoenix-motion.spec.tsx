import { act, fireEvent, render, screen } from '@testing-library/react';

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
    expect(video).toHaveAttribute('src', '/brand/animacoes/tela-inicial/fenix-loop.webm');
    expect(screen.getByAltText('Fênix')).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(4000));

    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByAltText('Fênix')).toBeInTheDocument();
  });

  it('toca o vídeo pedido, como o brasão da tela de login', () => {
    mockReducedMotion(false);
    const { container } = render(
      <PhoenixLoop
        src="/brand/animacoes/login/fenix-login-loop.webm"
        padded={false}
        fallback={<img alt="Fênix" />}
      />
    );

    expect(container.querySelector('video')).toHaveAttribute(
      'src',
      '/brand/animacoes/login/fenix-login-loop.webm'
    );
    expect(container.firstElementChild).toHaveAttribute('data-padded', 'false');
  });

  it('tocando, mostra o interruptor que para e retoma a animação, com dica (WCAG 2.2.2)', () => {
    mockReducedMotion(false);
    const { container } = render(<PhoenixLoop fallback={<img alt="Fênix" />} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    const pause = jest.spyOn(video, 'pause').mockImplementation(() => undefined);
    const play = jest.spyOn(video, 'play').mockResolvedValue(undefined);

    expect(screen.queryByRole('switch', { name: 'Animação da fênix' })).toBeNull();
    fireEvent.playing(video);

    const toggle = screen.getByRole('switch', { name: 'Animação da fênix' });

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveAccessibleDescription('Pausar a animação');

    fireEvent.pointerEnter(toggle.parentElement as HTMLElement, { pointerType: 'mouse' });
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-open', 'true');
    fireEvent.keyDown(toggle, { key: 'Escape' });
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-open', 'false');

    fireEvent.click(toggle);
    expect(pause).toHaveBeenCalled();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveAccessibleDescription('Continuar a animação');

    fireEvent.click(toggle);
    expect(play).toHaveBeenCalled();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
