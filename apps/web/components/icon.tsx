/**
 * Ícone do Bootstrap Icons (https://icons.getbootstrap.com, MIT). Decorativo por padrão
 * (`aria-hidden`); passe `label` quando o ícone for a única indicação do significado.
 * Use com moderação: ícone acompanha texto, não o substitui (docs/29 §3.11).
 */
export function Icon({
  name,
  label,
  className
}: {
  /** Nome sem o prefixo `bi-`, por exemplo `plus-lg`, `search`, `calendar-event`. */
  readonly name: string;
  readonly label?: string;
  readonly className?: string;
}) {
  return label ? (
    <i
      className={`bi bi-${name} icon${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={label}
    />
  ) : (
    <i className={`bi bi-${name} icon${className ? ` ${className}` : ''}`} aria-hidden="true" />
  );
}
