'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Icon } from '../../../components/icon';
import type { Campaign } from '../../../lib/campaign-types';
import { formatDateTime, plural } from '../../../lib/format';

/** Tempo de cada remessa na tela antes da troca automática. */
const SLIDE_MS = 4000;
/** Depois de um toque, a troca automática espera este tempo para voltar. */
const TOUCH_RESUME_MS = 5000;

/** Dias inteiros até o fim das vendas, contando o dia de hoje como "último dia". */
export function daysLeft(salesEndAt: string, now = new Date()): number {
  return Math.max(0, Math.ceil((new Date(salesEndAt).getTime() - now.getTime()) / 86_400_000));
}

type Direction = 'forward' | 'back';

function CampaignSlide({ campaign, titleId }: { campaign: Campaign; titleId: string }) {
  const days = daysLeft(campaign.salesEndAt);
  const minimum = campaign.minimumQuantity;

  return (
    <>
      <div className="campaign-highlight-text">
        <span className="campaign-highlight-tag">
          <Icon name="clock-history" /> Pré-venda
        </span>
        <h2 id={titleId}>{campaign.name}</h2>
        {campaign.description ? <p>{campaign.description}</p> : null}
        <p className="campaign-highlight-deadline">
          {days <= 1
            ? `Último dia: vendas até ${formatDateTime(campaign.salesEndAt)}`
            : `Faltam ${plural(days, 'dia', 'dias')}: vendas até ${formatDateTime(campaign.salesEndAt)}`}
        </p>
      </div>
      <div className="campaign-highlight-side">
        {minimum ? (
          <div className="campaign-progress">
            <span>
              {plural(campaign.paidQuantity, 'unidade paga', 'unidades pagas')} de {minimum} para a
              encomenda acontecer
            </span>
            <progress value={Math.min(campaign.paidQuantity, minimum)} max={minimum} />
          </div>
        ) : null}
      </div>
    </>
  );
}

/**
 * Destaque das pré-vendas abertas no topo da loja (Onda 1, docs/31; carrossel DT-090): uma
 * remessa por vez, com prazo e mínimo vindos da remessa. Com mais de uma, troca com o deslize
 * padrão de carrossel: a atual sai por um lado e a próxima entra pelo outro.
 * A troca automática para com o mouse, o toque ou o foco no cartão
 * (WCAG 2.2.2) e não acontece com "reduzir movimento". O botão fica parado: só o conteúdo da
 * remessa troca.
 */
export function CampaignHighlight({ campaigns }: { readonly campaigns: readonly Campaign[] }) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [direction, setDirection] = useState<Direction>('forward');
  const [run, setRun] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touchedAt, setTouchedAt] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);
  const count = campaigns.length;
  const multiple = count > 1;
  const paused = hovered || focused || touchedAt !== null;
  const settleTimer = useRef<number | undefined>(undefined);

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

      if (next === index) {
        return;
      }

      setLeaving(index);
      setDirection(dir);
      setIndex(next);
      setRun((value) => value + 1);
      // Garante a limpeza mesmo se o evento de fim da animação não vier (aba em segundo plano).
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => setLeaving(null), 1000);
    },
    [count, index]
  );

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  useEffect(() => {
    if (!multiple || paused || reduced) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        go(index + 1, 'forward');
      }
    }, SLIDE_MS);

    return () => window.clearTimeout(timer);
  }, [go, index, multiple, paused, reduced, run]);

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

  const current = campaigns[index] ?? campaigns[0];

  return (
    <section
      className={`campaign-highlight${multiple ? ' is-carousel' : ''}`}
      aria-roledescription={multiple ? 'carrossel' : undefined}
      aria-label={multiple ? 'Pré-vendas abertas' : undefined}
      aria-labelledby={multiple ? undefined : 'pre-venda-destaque-0'}
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
        {campaigns.map((campaign, position) => {
          const active = position === index;
          const state = active
            ? leaving !== null
              ? ' is-entering'
              : ' is-active'
            : position === leaving
              ? ' is-leaving'
              : '';

          return (
            <div
              key={campaign.id}
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
              <CampaignSlide campaign={campaign} titleId={`pre-venda-destaque-${position}`} />
            </div>
          );
        })}
      </div>

      <div className="campaign-highlight-action">
        <Link href="/loja?prevenda=1" className="btn btn-primary">
          Ver produtos da pré-venda
        </Link>
      </div>

      {multiple ? (
        <>
          <button
            type="button"
            className="campaign-nav is-prev"
            aria-label="Remessa anterior"
            onClick={() => go(index - 1, 'back')}
          >
            <Icon name="chevron-left" />
          </button>
          <button
            type="button"
            className="campaign-nav is-next"
            aria-label="Próxima remessa"
            onClick={() => go(index + 1, 'forward')}
          >
            <Icon name="chevron-right" />
          </button>
          <div className="campaign-dots">
            {campaigns.map((campaign, position) => (
              <button
                key={campaign.id}
                type="button"
                className="campaign-dot"
                aria-label={`Mostrar remessa ${position + 1} de ${count}: ${campaign.name}`}
                aria-current={position === index ? 'true' : undefined}
                onClick={() => go(position, position > index ? 'forward' : 'back')}
              />
            ))}
          </div>
          <span className="visually-hidden" aria-live="polite">
            {paused ? `Remessa ${index + 1} de ${count}: ${current?.name ?? ''}` : ''}
          </span>
        </>
      ) : null}
    </section>
  );
}
