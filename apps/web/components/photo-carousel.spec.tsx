import { act, fireEvent, render, screen } from '@testing-library/react';

import { CAROUSEL_INTERVAL_MS, PhotoCarousel } from './photo-carousel';

const photos = [
  { id: 'a', url: '/a.jpg', altText: 'Elenco feminino' },
  { id: 'b', url: '/b.jpg', altText: 'Elenco masculino' }
];

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: reduce,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }) as unknown as typeof window.matchMedia;
}

describe('fotos do clube passando sozinhas (DT-081)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('troca de foto sozinha e para com o botão Pausar', () => {
    mockReducedMotion(false);
    render(<PhotoCarousel photos={photos} />);

    expect(screen.getByText('1 de 2')).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(CAROUSEL_INTERVAL_MS));
    expect(screen.getByText('2 de 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Pausar/ }));
    act(() => jest.advanceTimersByTime(CAROUSEL_INTERVAL_MS * 2));
    expect(screen.getByText('2 de 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima foto' }));
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
  });

  it('com "reduzir movimento", não passa sozinha e não mostra Pausar', () => {
    mockReducedMotion(true);
    render(<PhotoCarousel photos={photos} />);

    act(() => jest.advanceTimersByTime(CAROUSEL_INTERVAL_MS * 2));
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pausar/ })).not.toBeInTheDocument();
  });
});
