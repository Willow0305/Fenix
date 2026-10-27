import { formatDateTime } from '../../../lib/format';

/** Período de venda do plano em texto ("sem prazo", "a partir de…", "até…"). */
export function salesWindow(plan: {
  readonly availableFrom: string | null;
  readonly availableUntil: string | null;
}): string {
  if (!plan.availableFrom && !plan.availableUntil) {
    return 'venda sem prazo';
  }

  if (!plan.availableUntil) {
    return `à venda a partir de ${formatDateTime(plan.availableFrom ?? '')}`;
  }

  return plan.availableFrom
    ? `à venda de ${formatDateTime(plan.availableFrom)} a ${formatDateTime(plan.availableUntil)}`
    : `à venda até ${formatDateTime(plan.availableUntil)}`;
}
