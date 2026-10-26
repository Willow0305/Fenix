'use client';

import { useId, useState } from 'react';

import { formatMoney, formatMonth } from '../lib/format';

/**
 * Gráficos do painel financeiro (DT-058), em SVG e sem biblioteca. Cores validadas para
 * daltonismo e contraste (categorias 1 e 2 da paleta de referência); texto sempre nas
 * cores de texto, nunca na cor da série; dica no foco e no mouse; tabela equivalente.
 */
export const SERIES = { income: '#2a78d6', expense: '#eb6834' } as const;

const WIDTH = 720;
const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 76 };
const BAR_MAX = 24;
const GAP = 2;

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Rótulo curto do mês ("out"); em janeiro e no primeiro ponto, com o ano ("jan/27"). */
export function shortMonth(month: string, first = false): string {
  const [year, value] = month.split('-');
  const name = MONTHS[Number(value) - 1] ?? month;

  return first || value === '01' ? `${name}/${year?.slice(2)}` : name;
}

/** Menor passo "redondo" (1, 2, 2,5, 5 × 10ⁿ) que cobre `value`. */
function niceStep(value: number): number {
  if (value <= 0) {
    return 1;
  }

  const power = 10 ** Math.floor(Math.log10(value));

  return ([1, 2, 2.5, 5, 10].find((candidate) => candidate * power >= value) ?? 10) * power;
}

/**
 * Marcas do eixo em passos redondos (0, 2 mil, 4 mil…), com o topo acima do maior valor.
 * `minTop` dá escala quando tudo é zero (sem isso, o eixo repetiria "R$ 0").
 */
export function axisTicks(maxValue: number, count = 4, minTop = 1): number[] {
  const step = niceStep(Math.max(maxValue, minTop) / count);
  const top = Math.max(step, Math.ceil(Math.max(maxValue, minTop) / step) * step);

  return Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
}

export function compactMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  }

  if (Math.abs(value) >= 1_000) {
    return `R$ ${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }

  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

/** Retângulo com 4 px arredondados só no topo (base reta na linha de base). */
function topRoundedBar(x: number, y: number, width: number, height: number): string {
  const r = Math.min(4, width / 2, height);

  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${y + height}`,
    'Z'
  ].join(' ');
}

export interface IncomeExpenseMonth {
  readonly month: string;
  readonly income: number;
  readonly expense: number;
}

interface Tip {
  readonly x: number;
  readonly y: number;
  readonly lines: readonly { label: string; value: string; color: string }[];
  readonly title: string;
}

function Tooltip({ tip }: { readonly tip: Tip | null }) {
  if (!tip) {
    return null;
  }

  return (
    <div
      className="chart-tip"
      role="status"
      style={{
        left: `${(tip.x / WIDTH) * 100}%`,
        top: `${(tip.y / HEIGHT) * 100}%`
      }}
    >
      <span className="chart-tip-title">{tip.title}</span>
      {tip.lines.map((line) => (
        <span key={line.label} className="chart-tip-row">
          <span className="chart-key-line" style={{ background: line.color }} aria-hidden="true" />
          <strong>{line.value}</strong> <span className="muted">{line.label}</span>
        </span>
      ))}
    </div>
  );
}

/** Receita × despesa por mês: colunas agrupadas, duas séries. */
export function IncomeExpenseChart({ data }: { readonly data: readonly IncomeExpenseMonth[] }) {
  const titleId = useId();
  const [tip, setTip] = useState<Tip | null>(null);
  const ticks = axisTicks(
    Math.max(...data.flatMap((row) => [row.income, row.expense]), 0),
    4,
    1000
  );
  const max = ticks[ticks.length - 1] ?? 1;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, data.length);
  const bar = Math.min(BAR_MAX, (band * 0.7 - GAP) / 2);
  const y = (value: number) => PAD.top + plotH - (value / max) * plotH;

  return (
    <figure className="chart" aria-labelledby={titleId}>
      <figcaption id={titleId} className="chart-title">
        Receita e despesa por mês
      </figcaption>
      <ul className="chart-legend" aria-label="Legenda">
        <li>
          <span className="chart-key-rect" style={{ background: SERIES.income }} /> Receita
        </li>
        <li>
          <span className="chart-key-rect" style={{ background: SERIES.expense }} /> Despesa
        </li>
      </ul>
      <div className="chart-frame" onPointerLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={titleId}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                className="chart-grid"
              />
              <text x={PAD.left - 8} y={y(tick) + 4} className="chart-axis" textAnchor="end">
                {compactMoney(tick)}
              </text>
            </g>
          ))}
          {data.map((row, index) => {
            const center = PAD.left + band * index + band / 2;
            const show = () =>
              setTip({
                x: center,
                y: Math.min(y(row.income), y(row.expense)),
                title: formatMonth(`${row.month}-01`),
                lines: [
                  {
                    label: 'Receita',
                    value: formatMoney(row.income.toFixed(2)),
                    color: SERIES.income
                  },
                  {
                    label: 'Despesa',
                    value: formatMoney(row.expense.toFixed(2)),
                    color: SERIES.expense
                  }
                ]
              });

            return (
              <g key={row.month}>
                {/* Área de toque maior que as colunas: o mês inteiro. */}
                <rect
                  x={PAD.left + band * index}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  className="chart-hit"
                  tabIndex={0}
                  aria-label={`${formatMonth(`${row.month}-01`)}: receita ${formatMoney(row.income.toFixed(2))}, despesa ${formatMoney(row.expense.toFixed(2))}`}
                  onPointerMove={show}
                  onFocus={show}
                  onBlur={() => setTip(null)}
                />
                {row.income > 0 ? (
                  <path
                    d={topRoundedBar(
                      center - bar - GAP / 2,
                      y(row.income),
                      bar,
                      y(0) - y(row.income)
                    )}
                    fill={SERIES.income}
                    pointerEvents="none"
                  />
                ) : null}
                {row.expense > 0 ? (
                  <path
                    d={topRoundedBar(center + GAP / 2, y(row.expense), bar, y(0) - y(row.expense))}
                    fill={SERIES.expense}
                    pointerEvents="none"
                  />
                ) : null}
                <text x={center} y={HEIGHT - 8} className="chart-axis" textAnchor="middle">
                  {shortMonth(row.month, index === 0)}
                </text>
              </g>
            );
          })}
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(0)}
            y2={y(0)}
            className="chart-baseline"
          />
        </svg>
        <Tooltip tip={tip} />
      </div>
    </figure>
  );
}

export interface RatePoint {
  readonly month: string;
  /** Percentual com uma casa ("12.5"), ou nulo sem mensalidade vencida no mês. */
  readonly rate: string | null;
}

/** Inadimplência por mês: uma série, linha com crosshair. */
export function OverdueRateChart({ data }: { readonly data: readonly RatePoint[] }) {
  const titleId = useId();
  const [active, setActive] = useState<number | null>(null);
  const values = data.map((point) => (point.rate === null ? null : Number(point.rate)));
  const ticks = axisTicks(Math.max(...values.map((value) => value ?? 0), 5), 3);
  const max = ticks[ticks.length - 1] ?? 1;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const step = plotW / Math.max(1, data.length - 1);
  const x = (index: number) => PAD.left + step * index;
  const y = (value: number) => PAD.top + plotH - (value / max) * plotH;
  // Meses sem taxa quebram a linha em trechos.
  const segments: string[] = [];
  let current = '';

  values.forEach((value, index) => {
    if (value === null) {
      if (current) {
        segments.push(current);
      }

      current = '';

      return;
    }

    current += `${current ? 'L' : 'M'}${x(index)},${y(value)} `;
  });

  if (current) {
    segments.push(current);
  }

  const activeValue = active === null ? null : values[active];
  const lastIndex = values.reduce<number | null>(
    (last, value, index) => (value === null ? last : index),
    null
  );

  return (
    <figure className="chart" aria-labelledby={titleId}>
      <figcaption id={titleId} className="chart-title">
        Inadimplência por mês de referência (%)
      </figcaption>
      <div
        className="chart-frame"
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const svgX = ((event.clientX - box.left) / box.width) * WIDTH;

          setActive(Math.max(0, Math.min(data.length - 1, Math.round((svgX - PAD.left) / step))));
        }}
        onPointerLeave={() => setActive(null)}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={titleId}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                className="chart-grid"
              />
              <text x={PAD.left - 8} y={y(tick) + 4} className="chart-axis" textAnchor="end">
                {tick.toLocaleString('pt-BR')}%
              </text>
            </g>
          ))}
          {active !== null ? (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              className="chart-crosshair"
            />
          ) : null}
          {segments.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke={SERIES.income}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {values.map((value, index) =>
            value === null ? null : (
              <circle
                key={data[index]?.month}
                cx={x(index)}
                cy={y(value)}
                r={index === active || index === lastIndex ? 5 : 4}
                fill={SERIES.income}
                className="chart-dot"
              />
            )
          )}
          {lastIndex !== null && values[lastIndex] !== null ? (
            <text
              x={x(lastIndex) - 8}
              y={y(values[lastIndex] ?? 0) - 10}
              className="chart-value"
              textAnchor="end"
            >
              {Number(values[lastIndex]).toLocaleString('pt-BR')}%
            </text>
          ) : null}
          {data.map((point, index) => (
            <text
              key={point.month}
              x={x(index)}
              y={HEIGHT - 8}
              className="chart-axis"
              textAnchor="middle"
            >
              {shortMonth(point.month, index === 0)}
            </text>
          ))}
        </svg>
        {active !== null ? (
          <Tooltip
            tip={{
              x: x(active),
              y:
                activeValue === null || activeValue === undefined
                  ? PAD.top + plotH / 2
                  : y(activeValue),
              title: formatMonth(`${data[active]?.month ?? ''}-01`),
              lines: [
                {
                  label: 'em atraso',
                  value:
                    activeValue === null || activeValue === undefined
                      ? 'sem mensalidade vencida'
                      : `${activeValue.toLocaleString('pt-BR')}%`,
                  color: SERIES.income
                }
              ]
            }}
          />
        ) : null}
      </div>
    </figure>
  );
}
