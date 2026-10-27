'use client';

import type { PersonalizationField, Variant } from '../lib/store-types';

type Attribute = 'size' | 'model' | 'color';

const ATTRIBUTES: { key: Attribute; label: string }[] = [
  { key: 'size', label: 'Tamanho' },
  { key: 'model', label: 'Modelo' },
  { key: 'color', label: 'Cor' }
];

/** O produto tem variações descritas por atributo (tamanho, modelo ou cor)? */
export function hasAttributes(variants: readonly Variant[]): boolean {
  return variants.some((v) => v.size || v.model || v.color);
}

/**
 * Seletores por atributo, como nas lojas profissionais (DT-069): escolhe-se tamanho, modelo
 * e cor separadamente e a variação é a combinação. Combinação sem estoque aparece apagada.
 */
export function AttributePicker({
  variants,
  value,
  onChange
}: {
  readonly variants: readonly Variant[];
  readonly value: string;
  readonly onChange: (variantId: string) => void;
}) {
  const current = variants.find((v) => v.id === value) ?? variants[0];

  function pick(key: Attribute, option: string) {
    const wanted = {
      size: current?.size,
      model: current?.model,
      color: current?.color,
      [key]: option
    };
    // Prefere a combinação exata; se não houver, a primeira com o atributo escolhido.
    const exact = variants.find(
      (v) => v.size === wanted.size && v.model === wanted.model && v.color === wanted.color
    );
    const fallback =
      variants.find((v) => v[key] === option && v.inStock) ??
      variants.find((v) => v[key] === option);

    onChange((exact ?? fallback)?.id ?? value);
  }

  return (
    <div className="stack" style={{ gap: '0.6rem' }}>
      {ATTRIBUTES.map(({ key, label }) => {
        const options = [
          ...new Set(variants.map((v) => v[key]).filter((o): o is string => Boolean(o)))
        ];

        if (options.length === 0) {
          return null;
        }

        return (
          <fieldset key={key} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: '0.4rem' }}>
              {label}: <span className="muted">{current?.[key] ?? '—'}</span>
            </legend>
            <div className="row">
              {options.map((option) => {
                const available = variants.some(
                  (v) =>
                    v[key] === option &&
                    v.inStock &&
                    ATTRIBUTES.every(
                      (other) =>
                        other.key === key ||
                        !current?.[other.key] ||
                        v[other.key] === current[other.key]
                    )
                );
                const selected = current?.[key] === option;

                return (
                  <button
                    key={option}
                    type="button"
                    className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ opacity: available || selected ? 1 : 0.5 }}
                    aria-pressed={selected}
                    onClick={() => pick(key, option)}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

/** Campos de personalização na página do produto (DT-069). */
export function PersonalizationInputs({
  fields,
  values,
  onChange
}: {
  readonly fields: readonly PersonalizationField[];
  readonly values: Record<string, string>;
  readonly onChange: (values: Record<string, string>) => void;
}) {
  return (
    <fieldset className="form-section">
      <legend>Personalize</legend>
      {fields.map((field) => (
        <label key={field.id} className="field">
          <span className="label">
            {field.label}
            {field.required ? ' *' : ' (opcional)'}
            {Number(field.extraPrice.amount) > 0
              ? ` · +R$ ${field.extraPrice.amount.replace('.', ',')}`
              : ''}
          </span>
          <input
            inputMode={field.kind === 'NUMBER' ? 'numeric' : 'text'}
            maxLength={field.kind === 'TEXT' ? (field.maxLength ?? 30) : 6}
            required={field.required}
            autoComplete="off"
            style={field.uppercase ? { textTransform: 'uppercase' } : undefined}
            value={values[field.id] ?? ''}
            onChange={(e) =>
              onChange({
                ...values,
                [field.id]:
                  field.kind === 'NUMBER' ? e.target.value.replace(/\D/g, '') : e.target.value
              })
            }
          />
          <small className="field-hint">
            {field.kind === 'TEXT'
              ? `Até ${field.maxLength ?? 30} caracteres.`
              : `De ${field.minValue ?? 0} a ${field.maxValue ?? 99}.`}
          </small>
        </label>
      ))}
    </fieldset>
  );
}
