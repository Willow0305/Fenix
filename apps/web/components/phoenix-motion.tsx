'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { allowsPhoenixVideo, PHOENIX_LOOP_SRC, readMotionEnvironment } from '../lib/phoenix-motion';
import styles from './phoenix-motion.module.scss';

/** Tempo para o loop começar a tocar; passou disso, a conexão está lenta e fica a logo. */
const LOOP_START_LIMIT_MS = 4000;

/** `true` depois de montar, se o aparelho e a conexão aguentam o vídeo (DT-098). */
function useVideoAllowed(): boolean {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => setAllowed(allowsPhoenixVideo(readMotionEnvironment())), []);

  return allowed;
}

/**
 * Fênix “viva” em loop por cima da logo parada (`fallback`). A logo continua ali, invisível,
 * e volta se o vídeo falhar ou demorar; é ela quem dá o texto alternativo.
 */
export function PhoenixLoop({
  fallback,
  src = PHOENIX_LOOP_SRC,
  padded = true,
  className
}: {
  readonly fallback: ReactNode;
  readonly src?: string;
  /** O vídeo tem margem em volta para o brilho e precisa ser ampliado. */
  readonly padded?: boolean;
  readonly className?: string | undefined;
}) {
  const allowed = useVideoAllowed();
  const [state, setState] = useState<'loading' | 'playing' | 'static'>('loading');

  useEffect(() => {
    if (!allowed) {
      return undefined;
    }

    const timer = window.setTimeout(
      () => setState((current) => (current === 'loading' ? 'static' : current)),
      LOOP_START_LIMIT_MS
    );

    return () => window.clearTimeout(timer);
  }, [allowed]);

  const showVideo = allowed && state !== 'static';

  return (
    <div
      className={`${styles.loop}${className ? ` ${className}` : ''}`}
      data-state={showVideo ? state : 'static'}
      data-padded={padded}
    >
      <div className={styles.still}>{fallback}</div>
      {showVideo ? (
        <video
          className={styles.video}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          // Sem o botão de vídeo flutuante nem transmissão para TV que o navegador põe por cima.
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setState('playing')}
          onError={() => setState('static')}
        />
      ) : null}
    </div>
  );
}

/** Classe do contêiner da tela de login: liga o brilho da fênix ao botão Entrar. */
export const PHOENIX_STAGE_CLASS = styles.stage;
