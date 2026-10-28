import { type Money, money, round2 } from '../../../common/domain/money';

/**
 * Desistência e defeito (DT-070). Prazos contam da entrega comprovada (foto da diretoria ou
 * "Recebi" do comprador); sem prova, o prazo ainda não começou. Funções puras.
 */
export const WITHDRAWAL_DAYS = 7;
export const DEFECT_DAYS = 90;
const DAY_MS = 86_400_000;

export interface ReturnFacts {
  readonly status: string;
  readonly deliveryConfirmedAt: Date | null;
}

const PAID = new Set(['PAID', 'PROCESSING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED']);

/** Até quando vale cada direito; nulo = prazo ainda não começou (ou não se aplica). */
export function returnDeadlines(order: ReturnFacts): {
  withdrawalUntil: Date | null;
  defectUntil: Date | null;
} {
  const confirmed = order.deliveryConfirmedAt;

  return {
    withdrawalUntil: confirmed ? new Date(confirmed.getTime() + WITHDRAWAL_DAYS * DAY_MS) : null,
    defectUntil: confirmed ? new Date(confirmed.getTime() + DEFECT_DAYS * DAY_MS) : null
  };
}

/**
 * Pode desistir? Pedido pago ainda não entregue: sim. Entregue: até 7 dias da entrega
 * comprovada (sem prova, o prazo não começou).
 */
export function canWithdraw(order: ReturnFacts, now: Date): boolean {
  if (!PAID.has(order.status)) {
    return false;
  }

  const { withdrawalUntil } = returnDeadlines(order);

  return order.status !== 'DELIVERED' || withdrawalUntil === null || now <= withdrawalUntil;
}

/** Pode relatar defeito? Só depois de entregue, até 90 dias da entrega comprovada. */
export function canReportDefect(order: ReturnFacts, now: Date): boolean {
  if (order.status !== 'DELIVERED') {
    return false;
  }

  const { defectUntil } = returnDeadlines(order);

  return defectUntil === null || now <= defectUntil;
}

/** Valor a devolver por parte das unidades de um item (já com o desconto do cupom). */
export function refundForUnits(itemTotal: Money, itemQuantity: number, units: number): Money {
  return round2(money(itemTotal).times(units).dividedBy(itemQuantity));
}
