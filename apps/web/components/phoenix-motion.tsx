'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import {
  allowsPhoenixVideo,
  PHOENIX_LOOP_SRC,
  PHOENIX_SUCCESS_MS,
  PHOENIX_SUCCESS_SRC,
  readMotionEnvironment
} from '../lib/phoenix-motion';
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
  className
}: {
  readonly fallback: ReactNode;
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
    >
      <div className={styles.still}>{fallback}</div>
      {showVideo ? (
        <video
          className={styles.video}
          src={PHOENIX_LOOP_SRC}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setState('playing')}
          onError={() => setState('static')}
        />
      ) : null}
    </div>
  );
}

/**
 * Explosão de brasas depois do login. `celebrate(done)` toca o vídeo em tela cheia e chama
 * `done` no fim; sem vídeo pronto (conexão lenta, aparelho fraco), chama `done` na hora.
 */
export function usePhoenixSuccess(): {
  readonly overlay: ReactNode;
  readonly celebrate: (done: () => void) => void;
} {
  const allowed = useVideoAllowed();
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const celebrate = useCallback((done: () => void) => {
    const element = video.current;

    // HAVE_ENOUGH_DATA: o navegador calcula que toca até o fim sem parar para carregar.
    if (!element || element.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      done();
      return;
    }

    let finished = false;
    const finish = () => {
      if (!finished) {
        finished = true;
        window.clearTimeout(limit);
        done();
      }
    };
    const limit = window.setTimeout(finish, PHOENIX_SUCCESS_MS + 1000);

    element.addEventListener('ended', finish, { once: true });
    element.addEventListener('error', finish, { once: true });
    setPlaying(true);
    element.currentTime = 0;
    element.play().catch(finish);
  }, []);

  const overlay = allowed ? (
    <div className={styles.success} data-playing={playing} aria-hidden="true">
      <video
        ref={video}
        className={styles.successVideo}
        src={PHOENIX_SUCCESS_SRC}
        muted
        playsInline
        preload="auto"
        tabIndex={-1}
      />
    </div>
  ) : null;

  return { overlay, celebrate };
}

/** Classe do contêiner da tela de login: liga o brilho da fênix ao botão Entrar. */
export const PHOENIX_STAGE_CLASS = styles.stage;
