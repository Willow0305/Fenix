'use client';

import { useEffect, useState } from 'react';

import { responsiveSrcSet } from '../lib/image-url';
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
  fallbackSrc,
  fallbackTone = 'brand',
  priority = false,
  sizes = '100vw',
  className,
  children
}: {
  readonly src: string | null | undefined;
  /** Use "" para imagem só ilustrativa. */
  readonly alt: string;
  readonly ratio?: MediaRatio;
  readonly fit?: 'cover' | 'contain';
  readonly fallbackSrc?: string | undefined;
  /** Fundo da reserva: escuro da marca (padrão) ou claro, para logos de terceiros. */
  readonly fallbackTone?: 'brand' | 'light';
  readonly priority?: boolean;
  /** Largura em que a imagem aparece, para o navegador escolher a versão (DT-082). */
  readonly sizes?: string;
  readonly className?: string;
  /** Selos posicionados sobre a imagem (docs/29 §3.7). */
  readonly children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  const showFallback = !src || failed;

  return (
    <div
      className={`media-frame${showFallback ? ` is-fallback is-${fallbackTone}` : ''}${className ? ` ${className}` : ''}`}
      style={{ aspectRatio: ratio }}
    >
      {showFallback ? (
        <img
          src={fallbackSrc ?? SYMBOL_SRC}
          srcSet={responsiveSrcSet(fallbackSrc ?? SYMBOL_SRC)}
          sizes="(min-width: 64rem) 16rem, 50vw"
          alt={alt}
          className="media-fallback"
          loading={priority ? 'eager' : 'lazy'}
        />
      ) : (
        <img
          src={src}
          srcSet={responsiveSrcSet(src)}
          sizes={sizes}
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
