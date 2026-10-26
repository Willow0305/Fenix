'use client';

import { useEffect, useState } from 'react';

import { Icon } from './icon';

/**
 * Quantidade com botões − e + (DT-051). O campo só aceita dígitos e respeita mínimo e
 * máximo; o valor digitado vale ao sair do campo ou com Enter.
 */
export function QuantityStepper({
  value,
  min = 1,
  max = 50,
  label,
  disabled = false,
  onChange
}: {
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  /** Nome acessível, ex.: "Quantidade de Camisa oficial". */
  readonly label: string;
  readonly disabled?: boolean;
  readonly onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  function commit(next: number) {
    const clamped = Math.min(max, Math.max(min, Number.isFinite(next) ? next : min));

    setDraft(String(clamped));

    if (clamped !== value) {
      onChange(clamped);
    }
  }

  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="stepper-button"
        aria-label="Diminuir"
        disabled={disabled || value <= min}
        onClick={() => commit(value - 1)}
      >
        <Icon name="dash-lg" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        className="stepper-input"
        value={draft}
        disabled={disabled}
        maxLength={String(max).length}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
        onBlur={() => commit(Number(draft))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit(Number(draft));
          }
        }}
      />
      <button
        type="button"
        className="stepper-button"
        aria-label="Aumentar"
        disabled={disabled || value >= max}
        onClick={() => commit(value + 1)}
      >
        <Icon name="plus-lg" />
      </button>
    </div>
  );
}
