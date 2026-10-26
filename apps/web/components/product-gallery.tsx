'use client';

import { type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from 'react';

import { Icon } from './icon';
import { MediaImage } from './media-image';

export interface GalleryImage {
  readonly id: string;
  readonly url: string;
  readonly altText: string | null;
}

const ZOOM = 2.5;

/** Posição do ponteiro dentro do elemento, em porcentagem (origem do zoom). */
function originOf(event: MouseEvent<HTMLElement>): string {
  const box = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - box.left) / box.width) * 100;
  const y = ((event.clientY - box.top) / box.height) * 100;

  return `${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`;
}

/**
 * Galeria do produto (DT-051): foto principal com lupa ao passar o mouse, miniaturas,
 * setas e teclado; tocar ou clicar abre em tela cheia com zoom que segue o dedo ou o mouse.
 */
export function ProductGallery({
  images,
  productName
}: {
  readonly images: readonly GalleryImage[];
  readonly productName: string;
}) {
  const [index, setIndex] = useState(0);
  const [hoverOrigin, setHoverOrigin] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState('50% 50%');
  const dialog = useRef<HTMLDialogElement>(null);
  const current = images[Math.min(index, images.length - 1)];
  const alt = (image: GalleryImage | undefined, position: number) =>
    image?.altText ?? `${productName} — foto ${position + 1} de ${images.length}`;

  useEffect(() => {
    // A lista muda quando a página recarrega com fotos novas.
    setIndex((value) => Math.min(value, Math.max(0, images.length - 1)));
  }, [images.length]);

  function go(step: number) {
    setIndex((value) => (value + step + images.length) % images.length);
    setZoomed(false);
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    }
  }

  function open() {
    setZoomed(false);
    dialog.current?.showModal();
  }

  if (!current) {
    return <MediaImage src={null} alt="" ratio="1/1" className="product-photo" />;
  }

  return (
    <div className="gallery" onKeyDown={onKey}>
      <button
        type="button"
        className="gallery-main product-photo"
        aria-label={`Ampliar foto: ${alt(current, index)}`}
        onClick={open}
        onPointerMove={(event) => {
          if (event.pointerType === 'mouse') {
            setHoverOrigin(originOf(event));
          }
        }}
        onPointerLeave={() => setHoverOrigin(null)}
      >
        <img
          src={current.url}
          alt={alt(current, index)}
          decoding="async"
          style={
            hoverOrigin
              ? { transform: 'scale(2)', transformOrigin: hoverOrigin }
              : { transformOrigin: 'center' }
          }
        />
        <span className="gallery-hint" aria-hidden="true">
          <Icon name="zoom-in" /> Ampliar
        </span>
      </button>

      {images.length > 1 ? (
        <>
          <div className="gallery-nav">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => go(-1)}
              aria-label="Foto anterior"
            >
              <Icon name="chevron-left" />
            </button>
            <span className="muted" aria-live="polite">
              {index + 1} de {images.length}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => go(1)}
              aria-label="Próxima foto"
            >
              <Icon name="chevron-right" />
            </button>
          </div>
          <ul className="gallery-thumbs" aria-label="Fotos do produto">
            {images.map((image, position) => (
              <li key={image.id}>
                <button
                  type="button"
                  className={position === index ? 'is-active' : undefined}
                  aria-label={`Ver foto ${position + 1}`}
                  aria-current={position === index ? 'true' : undefined}
                  onClick={() => {
                    setIndex(position);
                    setZoomed(false);
                  }}
                >
                  <img src={image.url} alt="" loading="lazy" decoding="async" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <dialog
        ref={dialog}
        className="gallery-dialog"
        aria-label={`Fotos de ${productName}`}
        onClose={() => setZoomed(false)}
        onKeyDown={onKey}
      >
        <div className="gallery-dialog-bar">
          <span>{images.length > 1 ? `${index + 1} de ${images.length}` : productName}</span>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setZoomed((value) => !value)}
            aria-pressed={zoomed}
          >
            <Icon name={zoomed ? 'zoom-out' : 'zoom-in'} /> {zoomed ? 'Reduzir' : 'Ampliar'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => dialog.current?.close()}
          >
            <Icon name="x-lg" /> Fechar
          </button>
        </div>
        <div
          className={`gallery-stage${zoomed ? ' is-zoomed' : ''}`}
          onClick={(event) => {
            setZoomOrigin(originOf(event));
            setZoomed((value) => !value);
          }}
          onPointerMove={(event) => {
            if (zoomed && (event.pointerType === 'mouse' || event.buttons > 0)) {
              setZoomOrigin(originOf(event));
            }
          }}
        >
          <img
            src={current.url}
            alt={alt(current, index)}
            style={{ transform: zoomed ? `scale(${ZOOM})` : 'none', transformOrigin: zoomOrigin }}
          />
        </div>
        {images.length > 1 ? (
          <div className="gallery-nav">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => go(-1)}
              aria-label="Foto anterior"
            >
              <Icon name="chevron-left" />
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => go(1)}
              aria-label="Próxima foto"
            >
              <Icon name="chevron-right" />
            </button>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
