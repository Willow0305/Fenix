'use client';

import { useEffect, useRef, useState } from 'react';

import { fixedSrcSet } from '../lib/image-url';
import { Icon } from './icon';

export interface NewsGalleryImage {
  readonly id: string;
  readonly url: string;
  readonly altText: string | null;
}

/**
 * Galeria da notícia (D8, DT-081): miniaturas que abrem a foto grande numa janela, com
 * legenda, anterior e próxima (também pelas setas do teclado) e Esc para fechar; mesma
 * janela escura das fotos do produto.
 */
export function NewsGallery({ images }: { readonly images: readonly NewsGalleryImage[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const image = current === null ? undefined : images[current];
  const total = images.length;

  useEffect(() => {
    const element = dialog.current;

    if (current !== null && element && !element.open) {
      element.showModal();
    }
  }, [current]);

  const step = (delta: number) =>
    setCurrent((index) => (index === null ? null : (index + delta + total) % total));

  return (
    <>
      <section aria-labelledby="galeria" className="stack">
        <h2 id="galeria" className="list-title">
          Galeria ({total} {total === 1 ? 'foto' : 'fotos'})
        </h2>
        <ul className="news-gallery list-plain">
          {images.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className="news-gallery-thumb"
                onClick={() => setCurrent(index)}
                aria-label={`Abrir foto ${index + 1} de ${total}${item.altText ? `: ${item.altText}` : ''}`}
              >
                <img src={item.url} srcSet={fixedSrcSet(item.url, 160)} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      </section>
      <dialog
        ref={dialog}
        className="gallery-dialog"
        aria-label="Foto da galeria"
        onClose={() => setCurrent(null)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') step(1);
          if (event.key === 'ArrowLeft') step(-1);
        }}
      >
        <div className="gallery-dialog-bar">
          <span>{current === null ? '' : `${current + 1} de ${total}`}</span>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => dialog.current?.close()}
          >
            <Icon name="x-lg" /> Fechar
          </button>
        </div>
        <figure className="gallery-stage m-0">
          {image && current !== null ? (
            <img src={image.url} alt={image.altText ?? `Foto ${current + 1} da galeria`} />
          ) : null}
        </figure>
        <div className="stack gap-sm">
          {image?.altText ? <p className="m-0 news-lightbox-caption">{image.altText}</p> : null}
          {total > 1 ? (
            <div className="gallery-nav">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => step(-1)}
                aria-label="Foto anterior"
              >
                <Icon name="chevron-left" />
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => step(1)}
                aria-label="Próxima foto"
              >
                <Icon name="chevron-right" />
              </button>
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
