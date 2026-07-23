import type { ReactNode } from 'react';

export interface TechnicalStatusProps {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly indicatorClassName?: string;
  readonly label: string;
}

export function TechnicalStatus({
  children,
  className,
  indicatorClassName,
  label
}: TechnicalStatusProps) {
  return (
    <div aria-live="polite" className={className} role="status">
      <span aria-hidden="true" className={indicatorClassName} />
      <div>
        <strong>{label}</strong>
        {children}
      </div>
    </div>
  );
}
