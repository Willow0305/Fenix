'use client';

import { useCallback, useEffect, useState } from 'react';

import { Icon } from './icon';

export interface CarouselPhoto {
  readonly id: string;
  readonly url: string;
  readonly altText: string | null;
}

/** Tempo de cada foto na tela. */
export const CAROUSEL_INTERVAL_MS = 6000;

/**
 * Fotos do clube passando de tempos em tempos (página Sobre, DT-081). Troca por esmaecimento;
 * para sozinha com o mouse em cima ou o foco dentro, tem botão de pausar (WCAG 2.2.2) e não
 * passa sozinha para quem pediu menos movimento.
 */
export function PhotoCarousel({ photos }: { readonly photos: readonly CarouselPhoto[] }) {
  const total = photos.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [reduced, setReduced] = useState(false);
  const go = useCallback((delta: number) => setIndex((i) => (i + delta + total) % total), [total]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);

    update();
    query.addEventListener('change', update);

    return () => query.removeEventListener('change', update);
  }, []);

  const running = total > 1 && !paused && !hovering && !reduced;

  useEffect(() => {
    if (!running) {
      return undefined;
    }

    const timer = window.setInterval(() => go(1), CAROUSEL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [running, go]);

  if (total === 0) {
    return null;
  }

  const current = photos[index];

  return (
    <section
      className="photo-carousel"
      aria-roledescription="carrossel"
      aria-label="Fotos do clube"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHovering(false);
        }
      }}
    >
      <div className="photo-carousel-stage">
        {photos.map((photo, position) => (
          <img
            key={photo.id}
            src={photo.url}
            alt={photo.altText ?? `Foto ${position + 1} do clube`}
            className={position === index ? 'is-current' : undefined}
            aria-hidden={position !== index}
            loading={position === 0 ? 'eager' : 'lazy'}
          />
        ))}
      </div>
      <div className="photo-carousel-bar">
        <p className="m-0" aria-live={running ? 'off' : 'polite'}>
          <span className="muted">
            {index + 1} de {total}
          </span>
          {current?.altText ? <span> · {current.altText}</span> : null}
        </p>
        {total > 1 ? (
          <div className="row gap-sm">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-label="Foto anterior"
              onClick={() => go(-1)}
            >
              <Icon name="chevron-left" />
            </button>
            {!reduced ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-pressed={paused}
                onClick={() => setPaused((value) => !value)}
              >
                <Icon name={paused ? 'play-fill' : 'pause-fill'} />{' '}
                {paused ? 'Continuar' : 'Pausar'}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-label="Próxima foto"
              onClick={() => go(1)}
            >
              <Icon name="chevron-right" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
