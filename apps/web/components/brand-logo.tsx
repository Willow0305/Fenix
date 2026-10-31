'use client';

import { useEffect, useRef, useState } from 'react';

import { BRASAO_SRC, SYMBOL_SRC } from '../lib/brand';
import { fixedSrcSet } from '../lib/image-url';

export { BRASAO_SRC, SYMBOL_SRC };

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

  const current = candidates[Math.min(index, candidates.length - 1)];

  return (
    <img
      ref={image}
      src={current}
      // O brasão é opcional e pode não existir: vai direto, sem o otimizador registrar erro.
      srcSet={current === BRASAO_SRC ? undefined : fixedSrcSet(current, size)}
      alt={alt}
      width={size}
      height={size}
      // `--logo-size` permite ao CSS reduzir a logo em telas pequenas sem perder o quadrado.
      style={{
        objectFit: 'contain',
        width: `var(--logo-size, ${size}px)`,
        height: `var(--logo-size, ${size}px)`
      }}
      onError={next}
    />
  );
}
