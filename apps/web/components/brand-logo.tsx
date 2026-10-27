'use client';

import { useEffect, useRef, useState } from 'react';

/** Brasão oficial salvo em `public/brand/` (ver docs/COMO-EXECUTAR.md). */
export const BRASAO_SRC = '/brand/brasao-fenix.png';
/** Símbolo da fênix usado se o brasão ainda não foi adicionado. */
export const SYMBOL_SRC = '/brand/logo-fenix.png';

/**
 * Logo do time. Ordem de preferência: logo enviado pelo painel, brasão em
 * `public/brand/brasao-fenix.png` e, por fim, o símbolo da fênix. Se uma imagem falhar ao
 * carregar, usa a próxima da lista.
 */
export function BrandLogo({
  src,
  alt = 'Brasão Time Fênix Volleyball',
  size = 44
}: {
  readonly src?: string | undefined;
  readonly alt?: string | undefined;
  readonly size?: number;
}) {
  const candidates = [src, BRASAO_SRC, SYMBOL_SRC].filter((value): value is string =>
    Boolean(value)
  );
  const [index, setIndex] = useState(0);
  const image = useRef<HTMLImageElement>(null);
  const next = () =>
    setIndex((current) => (current < candidates.length - 1 ? current + 1 : current));

  useEffect(() => setIndex(0), [src]);

  // Imagem que falhou antes de o React assumir a página não dispara `onError` de novo.
  useEffect(() => {
    const element = image.current;

    if (element?.complete && element.naturalWidth === 0) {
      next();
    }
  }, [index, src]);

  return (
    <img
      ref={image}
      src={candidates[Math.min(index, candidates.length - 1)]}
      alt={alt}
      width={size}
      height={size}
      style={{ objectFit: 'contain', width: size, height: size }}
      onError={next}
    />
  );
}
