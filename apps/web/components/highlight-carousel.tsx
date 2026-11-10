'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { Icon } from './icon';

/** Tempo de cada item na tela antes da troca automática. */
const SLIDE_MS = 4000;
/** Depois de um toque, a troca automática espera este tempo para voltar. */
const TOUCH_RESUME_MS = 5000;

type Direction = 'forward' | 'back';

export interface HighlightCarouselLabels {
  /** Nome do carrossel para leitor de tela, ex.: "Pré-vendas abertas". */
  readonly region: string;
  /** Nome de um item, no singular e em minúsculas, ex.: "remessa", "seletiva". */
  readonly item: string;
}

/**
 * Cartão de destaque escuro com um item por vez (DT-090, reaproveitado pelas seletivas em
 * `DT-099`). Com um item, só o cartão; com mais de um, deslize padrão de carrossel: o atual
 * sai por um lado e o próximo entra pelo outro, setas e uma bolinha por item. A troca
 * automática para com o mouse, o toque ou o foco no cartão, tem botão de pausar (WCAG 2.2.2,
 * como o `PhotoCarousel`) e não acontece com "reduzir movimento". `action` fica parado; só o
 * conteúdo do item troca.
 *
 * As classes continuam `campaign-*` porque o estilo nasceu na pré-venda e é o mesmo.
 */
export function HighlightCarousel<T extends { readonly id: string }>({
  items,
  idPrefix,
  labels,
  itemName,
  renderSlide,
  action
}: {
  readonly items: readonly T[];
  /** Prefixo dos ids dos títulos (`${idPrefix}-0`, `${idPrefix}-1`...). */
  readonly idPrefix: string;
  readonly labels: HighlightCarouselLabels;
  readonly itemName: (item: T) => string;
  readonly renderSlide: (item: T, titleId: string) => ReactNode;
  readonly action?: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [direction, setDirection] = useState<Direction>('forward');
  const [run, setRun] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touchedAt, setTouchedAt] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);
  // Pausa escolhida pela pessoa no botão: só volta quando ela pedir.
  const [stopped, setStopped] = useState(false);
  const count = items.length;
  const multiple = count > 1;
  const paused = stopped || hovered || focused || touchedAt !== null;
  const settleTimer = useRef<number | undefined>(undefined);
  const item = labels.item;
  const Item = item.charAt(0).toUpperCase() + item.slice(1);

  // A lista pode encolher (item que fecha com a página aberta): o índice não passa do fim.
  const safeIndex = count === 0 ? 0 : Math.min(index, count - 1);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);

    update();
    query.addEventListener('change', update);

    return () => query.removeEventListener('change', update);
  }, []);

  const go = useCallback(
    (target: number, dir: Direction) => {
      const next = (target + count) % count;

      if (next === safeIndex) {
        return;
      }

      setLeaving(safeIndex);
      setDirection(dir);
      setIndex(next);
      setRun((value) => value + 1);
      // Garante a limpeza mesmo se o evento de fim da animação não vier (aba em segundo plano).
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => setLeaving(null), 1000);
    },
    [count, safeIndex]
  );

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  useEffect(() => {
    if (!multiple || paused || reduced) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        go(safeIndex + 1, 'forward');
      }
    }, SLIDE_MS);

    return () => window.clearTimeout(timer);
  }, [go, safeIndex, multiple, paused, reduced, run]);

  useEffect(() => {
    if (touchedAt === null) {
      return undefined;
    }

    const timer = window.setTimeout(() => setTouchedAt(null), TOUCH_RESUME_MS);

    return () => window.clearTimeout(timer);
  }, [touchedAt]);

  if (count === 0) {
    return null;
  }

  const current = items[safeIndex] ?? items[0];

  return (
    <section
      className={`campaign-highlight${multiple ? ' is-carousel' : ''}`}
      aria-roledescription={multiple ? 'carrossel' : undefined}
      aria-label={multiple ? labels.region : undefined}
      aria-labelledby={multiple ? undefined : `${idPrefix}-0`}
      onPointerEnter={(event) => event.pointerType !== 'touch' && setHovered(true)}
      onPointerLeave={(event) => event.pointerType !== 'touch' && setHovered(false)}
      onPointerDown={(event) => event.pointerType === 'touch' && setTouchedAt(Date.now())}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
    >
      <div className={`campaign-stage${direction === 'back' ? ' is-back' : ''}`}>
        {items.map((entry, position) => {
          const active = position === safeIndex;
          const state = active
            ? leaving !== null
              ? ' is-entering'
              : ' is-active'
            : position === leaving
              ? ' is-leaving'
              : '';

          return (
            <div
              key={entry.id}
              className={`campaign-slide${state}`}
              role={multiple ? 'group' : undefined}
              aria-roledescription={multiple ? 'slide' : undefined}
              aria-label={multiple ? `${position + 1} de ${count}` : undefined}
              aria-hidden={!active}
              inert={!active}
              onAnimationEnd={(event) => {
                if (active && event.target === event.currentTarget) {
                  setLeaving(null);
                }
              }}
            >
              {renderSlide(entry, `${idPrefix}-${position}`)}
            </div>
          );
        })}
      </div>

      {action ? <div className="campaign-highlight-action">{action}</div> : null}

      {multiple ? (
        <>
          <button
            type="button"
            className="campaign-nav is-prev"
            aria-label={`${Item} anterior`}
            onClick={() => go(safeIndex - 1, 'back')}
          >
            <Icon name="chevron-left" />
          </button>
          <button
            type="button"
            className="campaign-nav is-next"
            aria-label={`Próxima ${item}`}
            onClick={() => go(safeIndex + 1, 'forward')}
          >
            <Icon name="chevron-right" />
          </button>
          <div className="campaign-dots">
            {reduced ? null : (
              <button
                type="button"
                className="campaign-pause"
                aria-label={`Pausar a troca automática de ${labels.region.toLowerCase()}`}
                aria-pressed={stopped}
                onClick={() => setStopped((value) => !value)}
              >
                <Icon name={stopped ? 'play-fill' : 'pause-fill'} />
              </button>
            )}
            {items.map((entry, position) => (
              <button
                key={entry.id}
                type="button"
                className="campaign-dot"
                aria-label={`Mostrar ${item} ${position + 1} de ${count}: ${itemName(entry)}`}
                aria-current={position === safeIndex ? 'true' : undefined}
                onClick={() => go(position, position > safeIndex ? 'forward' : 'back')}
              />
            ))}
          </div>
          <span className="visually-hidden" aria-live="polite">
            {paused && current ? `${Item} ${safeIndex + 1} de ${count}: ${itemName(current)}` : ''}
          </span>
        </>
      ) : null}
    </section>
  );
}
