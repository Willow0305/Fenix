'use client';

import { useEffect, useState } from 'react';

import { SYMBOL_SRC } from './brand-logo';

export type MediaRatio = '16/9' | '1/1' | '4/3';

/**
 * Imagem com espaço reservado e reserva da logo Fênix (docs/29 §3.6). Sem imagem, ou se o
 * arquivo não carregar (removido, corrompido), mostra a logo centralizada no fundo da
 * marca; a página não "pula" porque a proporção é fixa.
 */
export function MediaImage({
  src,
  alt,
  ratio = '16/9',
  fit = 'cover',
  fallbackSrc = SYMBOL_SRC,
  priority = false,
  className,
  children
}: {
  readonly src: string | null | undefined;
  /** Use "" para imagem só ilustrativa. */
  readonly alt: string;
  readonly ratio?: MediaRatio;
  readonly fit?: 'cover' | 'contain';
  readonly fallbackSrc?: string;
  readonly priority?: boolean;
  readonly className?: string;
  /** Selos posicionados sobre a imagem (docs/29 §3.7). */
  readonly children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  const showFallback = !src || failed;

  return (
    <div
      className={`media-frame${showFallback ? ' is-fallback' : ''}${className ? ` ${className}` : ''}`}
      style={{ aspectRatio: ratio }}
    >
      {showFallback ? (
        <img src={fallbackSrc} alt={alt} className="media-fallback" loading="lazy" />
      ) : (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          style={{ objectFit: fit }}
          onError={() => setFailed(true)}
        />
      )}
      {children}
    </div>
  );
}
