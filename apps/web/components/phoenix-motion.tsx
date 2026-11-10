'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { allowsPhoenixVideo, PHOENIX_LOOP_SRC, readMotionEnvironment } from '../lib/phoenix-motion';
import styles from './phoenix-motion.module.scss';

/** Tempo para o loop começar a tocar; passou disso, a conexão está lenta e fica a logo. */
const LOOP_START_LIMIT_MS = 4000;

/** Foco vindo do teclado (não do toque nem do clique): só ele abre a dica sozinho. */
function focusFromKeyboard(element: HTMLElement): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
}

/** `true` depois de montar, se o aparelho e a conexão aguentam o vídeo (DT-098). */
function useVideoAllowed(): boolean {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => setAllowed(allowsPhoenixVideo(readMotionEnvironment())), []);

  return allowed;
}

/**
 * Fênix “viva” em loop por cima da logo parada (`fallback`). A logo continua ali, invisível,
 * e volta se o vídeo falhar ou demorar; é ela quem dá o texto alternativo. O loop passa de
 * 5 s, então tem botão de pausar (WCAG 2.2.2); pausada, fica parada no quadro em que estava.
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
  const [paused, setPaused] = useState(false);
  // Dica do interruptor: aparece com o mouse ou o foco, some com Esc (WCAG 1.4.13).
  const [hint, setHint] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const hintId = useId();

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

  function togglePause() {
    const element = video.current;

    if (!element) {
      return;
    }

    if (paused) {
      void element.play().catch(() => undefined);
    } else {
      element.pause();
    }

    setPaused(!paused);
  }

  return (
    <div
      className={`${styles.loop}${className ? ` ${className}` : ''}`}
      data-state={showVideo ? state : 'static'}
      data-padded={padded}
    >
      <div className={styles.still}>{fallback}</div>
      {showVideo ? (
        <video
          ref={video}
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
      {showVideo && state === 'playing' ? (
        // Interruptor: bolinha à direita e trilho vermelho = animando; à esquerda = parada.
        <div
          className={styles.switchArea}
          onPointerEnter={(event) => event.pointerType !== 'touch' && setHint(true)}
          onPointerLeave={(event) => event.pointerType !== 'touch' && setHint(false)}
        >
          <button
            type="button"
            role="switch"
            className={styles.switch}
            aria-checked={!paused}
            aria-label="Animação da fênix"
            aria-describedby={hintId}
            onClick={togglePause}
            onFocus={(event) => setHint(focusFromKeyboard(event.currentTarget))}
            onBlur={() => setHint(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setHint(false);
              }
            }}
          >
            <span className={styles.knob} aria-hidden="true" />
          </button>
          <span id={hintId} role="tooltip" className={styles.hint} data-open={hint}>
            {paused ? 'Continuar a animação' : 'Pausar a animação'}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Classe do contêiner da tela de login: liga o brilho da fênix ao botão Entrar. */
export const PHOENIX_STAGE_CLASS = styles.stage;
