'use client';

import { POSITIONS, UNDECIDED_POSITION } from '../lib/sports-types';

/** Marca ou desmarca uma posição; "Ainda não sei" não combina com as outras (DT-085). */
export function togglePosition(
  current: readonly string[],
  position: string,
  checked: boolean
): string[] {
  if (!checked) {
    return current.filter((item) => item !== position);
  }

  return position === UNDECIDED_POSITION
    ? [position]
    : [...current.filter((item) => item !== UNDECIDED_POSITION && item !== position), position];
}

/**
 * Uma ou mais posições em caixas de marcar (DT-085). Posição já gravada fora da lista
 * padrão (texto antigo, como "Oposto") continua aparecendo, para não sumir sem querer.
 */
export function PositionChoices({
  legend,
  value,
  onChange
}: {
  readonly legend: string;
  readonly value: readonly string[];
  readonly onChange: (positions: string[]) => void;
}) {
  const options = [...new Set([...POSITIONS, ...value])];

  return (
    <fieldset className="position-choices">
      <legend className="label">{legend}</legend>
      <div className="position-options">
        {options.map((position) => (
          <label key={position} className="checkbox">
            <input
              type="checkbox"
              checked={value.includes(position)}
              onChange={(event) => onChange(togglePosition(value, position, event.target.checked))}
            />
            <span>{position}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
