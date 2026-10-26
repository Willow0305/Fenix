import { randomInt } from 'node:crypto';

import type {
  InventoryMovementType,
  OrderStatus,
  ProductFulfillmentType,
  ProductStatus
} from '@prisma/client';

import { type Money, round2, ZERO } from '../../../common/domain/money';
import type { TransitionTable } from '../../../common/domain/state-machine';

/** Regras puras da loja (RN-LOJ-*, PEN-027..030, DT-031). */

export const RESERVATION_HOURS_DEFAULT = 72;
export const MAX_ITEM_QUANTITY = 50;

export interface PriceSource {
  readonly basePrice: Money;
  readonly promotionalPrice: Money | null;
}

export interface VariantPriceSource {
  readonly priceOverride: Money | null;
  readonly promotionalPriceOverride: Money | null;
}

/** Preço efetivo: promoção da variante > preço da variante > promoção do produto > preço base. */
export function effectiveUnitPrice(product: PriceSource, variant: VariantPriceSource): Money {
  const regular = variant.priceOverride ?? product.basePrice;
  const promotional =
    variant.promotionalPriceOverride ??
    (variant.priceOverride === null ? product.promotionalPrice : null);

  return round2(promotional !== null && promotional.lessThan(regular) ? promotional : regular);
}

export function listPrice(product: PriceSource, variant: VariantPriceSource): Money {
  return round2(variant.priceOverride ?? product.basePrice);
}

/**
 * Efeito de cada movimento no estoque disponível. Reserva retira do disponível; ao
 * pagar, a reserva é liberada e registrada a saída efetiva (efeito líquido zero).
 */
export const MOVEMENT_SIGN: Record<InventoryMovementType, 1 | -1 | 0> = {
  STOCK_IN: 1,
  STOCK_OUT: -1,
  RESERVATION: -1,
  RELEASE: 1,
  ADJUSTMENT: 0,
  RETURN: 1,
  LOSS: -1
};

export interface StockMovement {
  readonly type: InventoryMovementType;
  readonly quantityDelta: number;
}

/** Disponível para venda = soma dos deltas (o sinal já é gravado no delta). */
export function availableStock(movements: readonly StockMovement[]): number {
  return movements.reduce((total, movement) => total + movement.quantityDelta, 0);
}

/** Reservas ainda não convertidas nem liberadas. */
export function reservedStock(movements: readonly StockMovement[]): number {
  const net = movements
    .filter((movement) => movement.type === 'RESERVATION' || movement.type === 'RELEASE')
    .reduce((total, movement) => total + movement.quantityDelta, 0);

  return net === 0 ? 0 : -net;
}

export function signedDelta(type: InventoryMovementType, quantity: number): number {
  const sign = MOVEMENT_SIGN[type];

  return sign === 0 ? quantity : sign * Math.abs(quantity);
}

export function isPurchasable(
  product: {
    status: ProductStatus;
    fulfillmentType: ProductFulfillmentType;
    availableFrom: Date | null;
    availableUntil: Date | null;
  },
  now: Date
): boolean {
  if (
    product.status !== 'ACTIVE' ||
    product.fulfillmentType === 'DIGITAL' ||
    product.fulfillmentType === 'CAMPAIGN'
  ) {
    return false;
  }

  if (product.availableFrom && now < product.availableFrom) {
    return false;
  }

  return !(product.availableUntil && now > product.availableUntil);
}

export function requiresStock(fulfillment: ProductFulfillmentType): boolean {
  return fulfillment === 'STOCK';
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED: 'Criado',
  AWAITING_PAYMENT: 'Aguardando pagamento',
  PAID: 'Pago',
  PROCESSING: 'Em separação',
  READY_FOR_PICKUP: 'Pronto para retirada',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
  REFUNDED: 'Reembolsado'
};

/** Transições manuais. PAID só ocorre pela confirmação do pagamento. */
export const ORDER_TRANSITIONS: TransitionTable<OrderStatus> = {
  CREATED: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['CANCELLED'],
  PAID: ['PROCESSING', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED'],
  PROCESSING: ['READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED'],
  READY_FOR_PICKUP: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED']
};

export function isPaidState(status: OrderStatus): boolean {
  return (
    status === 'PAID' ||
    status === 'PROCESSING' ||
    status === 'READY_FOR_PICKUP' ||
    status === 'DELIVERED'
  );
}

export interface LineInput {
  readonly unitPrice: Money;
  readonly quantity: number;
}

export function lineTotal(line: LineInput): Money {
  return round2(line.unitPrice.mul(line.quantity));
}

export function orderTotal(lines: readonly LineInput[]): Money {
  return round2(lines.reduce<Money>((total, line) => total.plus(lineTotal(line)), ZERO));
}

/** Número legível e não sequencial: FNX-AAMMDD-XXXXXX (letras sem ambiguidade). */
export function generateOrderNumber(now: Date = new Date()): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const date = now.toISOString().slice(2, 10).replaceAll('-', '');
  const suffix = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');

  return `FNX-${date}-${suffix}`;
}

export function buyerLimitExceeded(
  limit: number | null,
  alreadyBought: number,
  requested: number
): boolean {
  return limit !== null && alreadyBought + requested > limit;
}

/** Fotos por produto (DT-051): o bastante para mostrar ângulos e detalhes. */
export const MAX_PRODUCT_IMAGES = 12;

/**
 * Nova ordem das fotos: precisa conter exatamente as fotos atuais, sem repetir. A primeira
 * vira a capa (vitrine, carrinho e compartilhamento).
 */
export function isSameImageSet(current: readonly string[], requested: readonly string[]): boolean {
  return (
    current.length === requested.length &&
    new Set(requested).size === requested.length &&
    requested.every((id) => current.includes(id))
  );
}

/** A partir de quantas unidades a loja mostra "últimas unidades". */
export const LOW_STOCK_THRESHOLD = 3;
