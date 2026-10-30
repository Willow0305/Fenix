import { Icon } from './icon';

const nota = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Estrelas de 0 a 5 com nome acessível ("4,3 de 5 estrelas"); meia estrela a partir de ,5. */
export function Stars({
  value,
  size = 'md'
}: {
  readonly value: number;
  readonly size?: 'sm' | 'md';
}) {
  return (
    <span className={`stars stars-${size}`} role="img" aria-label={`${nota(value)} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <Icon
          key={step}
          name={value >= step ? 'star-fill' : value >= step - 0.5 ? 'star-half' : 'star'}
        />
      ))}
    </span>
  );
}

/** Escolha da nota com rádios nativos: setas do teclado mudam a nota, como em qualquer rádio. */
export function StarInput({
  value,
  onChange,
  name = 'nota'
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly name?: string;
}) {
  return (
    <fieldset className="star-input">
      <legend>Sua nota</legend>
      {[1, 2, 3, 4, 5].map((step) => (
        <label key={step} className={value >= step ? 'is-on' : undefined}>
          <input
            type="radio"
            name={name}
            value={step}
            checked={value === step}
            onChange={() => onChange(step)}
            className="visually-hidden"
          />
          <Icon name={value >= step ? 'star-fill' : 'star'} />
          <span className="visually-hidden">
            {step} {step === 1 ? 'estrela' : 'estrelas'}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
