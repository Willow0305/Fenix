import type { DeliveryAddress, DeliveryProofKind, OrderFulfillment } from './delivery-types';
import type { MoneyView, Payment } from './finance-types';

export type Fulfillment = 'STOCK' | 'MADE_TO_ORDER' | 'CAMPAIGN' | 'DIGITAL' | 'MEMBERSHIP';

/** Campo de personalização (DT-069). */
export interface PersonalizationField {
  id: string;
  label: string;
  kind: 'TEXT' | 'NUMBER';
  required: boolean;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  uppercase: boolean;
  extraPrice: MoneyView;
  sortOrder: number;
  isActive: boolean;
}

/** Beneficiário de afiliação (DT-068). */
export interface Beneficiary {
  name: string;
  email: string | null;
  cardId: string | null;
}
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'SOLD_OUT' | 'ARCHIVED';
export type OrderStatus =
  | 'CREATED'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
}

export interface Variant {
  id: string;
  sku: string;
  name: string;
  size: string | null;
  color: string | null;
  model: string | null;
  gender: string | null;
  price: MoneyView;
  listPrice: MoneyView;
  isActive: boolean;
  minimumStock: number;
  stock: { available: number; reserved: number; onHand: number } | null;
  inStock: boolean;
  /** Restam poucas unidades (DT-051). */
  lowStock: boolean;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  category: { id: string; name: string; slug: string };
  fulfillmentType: Fulfillment;
  status: ProductStatus;
  isFeatured: boolean;
  priceFrom: MoneyView;
  listPriceFrom: MoneyView;
  image: { url: string; altText: string | null } | null;
  purchasable: boolean;
  partner: { id: string; name: string; logoUrl: string | null } | null;
  campaign: { slug: string; name: string; salesEndAt: string } | null;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  buyerLimit: number | null;
  productionLeadDays: number | null;
  membershipMonths: number | null;
  membershipAnnouncedAt: string | null;
  /** Cartão (DT-079): parcelas sem juros até N; nulo = só com juros. */
  interestFreeInstallments: number | null;
  sizeGuide: string | null;
  personalizationFields: PersonalizationField[];
  isPersonalized: boolean;
  pickupInstructions: string | null;
  availableFrom: string | null;
  availableUntil: string | null;
  images: { id: string; url: string; altText: string | null; isPrimary: boolean }[];
  variants: Variant[];
  costPrice?: MoneyView | null;
  basePrice?: MoneyView;
  promotionalPrice?: MoneyView | null;
  commissionOverride?: {
    type: 'NONE' | 'PERCENTAGE' | 'FIXED';
    percentage: string | null;
    fixedAmount: MoneyView | null;
  } | null;
}

export interface CartLine {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  image: string | null;
  quantity: number;
  unitPrice: MoneyView;
  lineTotal: MoneyView;
  campaign: { slug: string; name: string } | null;
  warning: 'UNAVAILABLE' | 'INSUFFICIENT_STOCK' | 'BENEFICIARIES_REQUIRED' | null;
  fulfillmentType: Fulfillment;
  membershipMonths: number | null;
  beneficiaries: Beneficiary[] | null;
  personalizationValues: Record<string, string>;
  personalization: { fieldId: string; label: string; value: string; extraPrice: string }[];
  isPersonalized: boolean;
  personalizationFields: {
    id: string;
    label: string;
    kind: 'TEXT' | 'NUMBER';
    required: boolean;
    maxLength: number | null;
    minValue: number | null;
    maxValue: number | null;
    uppercase: boolean;
    extraPrice: string;
  }[];
  available: number | null;
  /** Outras opções do mesmo produto, para trocar no carrinho (DT-051). */
  options: { variantId: string; name: string; available: number | null }[];
}

export interface Cart {
  id: string | null;
  lines: CartLine[];
  itemCount: number;
  total: MoneyView;
  hasWarnings: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  variantName: string | null;
  quantity: number;
  unitPrice: MoneyView;
  /** Parte do desconto do cupom neste item (DT-045). */
  discountAmount: MoneyView;
  totalAmount: MoneyView;
  campaign: { id: string; name: string; status: string } | null;
  partnerId: string | null;
  pickedUpAt: string | null;
  arrivalNotifiedAt: string | null;
  /** Personalização travada na compra (DT-069). */
  personalization: { label: string; value: string }[];
  /** Afiliação: beneficiários (DT-068). */
  beneficiaries: string[];
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  isGuest: boolean;
  subtotalAmount: MoneyView;
  discountAmount: MoneyView;
  coupon: { code: string; released: boolean } | null;
  totalAmount: MoneyView;
  paidAmount: MoneyView;
  pendingAmount: MoneyView;
  notes: string | null;
  items: OrderItem[];
  payments: Payment[];
  createdAt: string;
  paidAt: string | null;
  readyForPickupAt: string | null;
  deliveredAt: string | null;
  deliveryConfirmedAt: string | null;
  receiptConfirmedAt: string | null;
  hasDeliveryProof: boolean;
  cancelledAt: string | null;
  cancellationReason: string | null;
  reservationExpiresAt: string | null;
  /** Retirada ou entrega em casa (DT-075). */
  fulfillment: OrderFulfillment;
  /** PIX (30 min) ou cartão com a diretoria (72 h) (DT-076). */
  paymentChoice: 'PIX' | 'CARD' | 'ONLINE_CARD';
  deliveryFee: MoneyView;
  deliveryAddress: DeliveryAddress | null;
  outForDeliveryAt: string | null;
  deliveryProofKind: DeliveryProofKind | null;
  /** Só primeiro nome, veículo e placa de quem leva. */
  courier: { firstName: string | null; vehicle: string | null; plate: string | null } | null;
  /** Só para o comprador, com o pedido a caminho. */
  deliveryCode?: string;
  notReceivedUntil: string | null;
  notReceivedAt: string | null;
  notReceivedNote: string | null;
  notReceivedResolution: 'REDELIVER' | 'REFUND' | 'KEEP' | null;
  paymentInfo?: { pixKey: string | null; bankingDetails: string | null };
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; badge: string }> = {
  CREATED: { label: 'Criado', badge: '' },
  AWAITING_PAYMENT: { label: 'Aguardando pagamento', badge: 'badge-warning' },
  PAID: { label: 'Pago', badge: 'badge-success' },
  PROCESSING: { label: 'Em separação', badge: 'badge-info' },
  READY_FOR_PICKUP: { label: 'Pronto para retirada', badge: 'badge-brand' },
  OUT_FOR_DELIVERY: { label: 'Saiu para entrega', badge: 'badge-info' },
  DELIVERED: { label: 'Entregue', badge: 'badge-success' },
  CANCELLED: { label: 'Cancelado', badge: '' },
  REFUNDED: { label: 'Reembolsado', badge: 'badge-danger' }
};

export const ORDER_NEXT: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ['CANCELLED'],
  AWAITING_PAYMENT: ['CANCELLED'],
  PAID: ['PROCESSING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  PROCESSING: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  READY_FOR_PICKUP: ['DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'PROCESSING', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: []
};

/** Próximos estados que fazem sentido para o tipo de recebimento do pedido (DT-075). */
export function orderNext(order: {
  status: OrderStatus;
  fulfillment: OrderFulfillment;
}): OrderStatus[] {
  return ORDER_NEXT[order.status].filter((status) =>
    // "Saiu para entrega" sai pelo quadro de entrega (código e link do entregador).
    // "Não deu certo" (volta para separação) também fica no quadro, com o motivo.
    order.fulfillment === 'DELIVERY'
      ? status !== 'READY_FOR_PICKUP' &&
        status !== 'OUT_FOR_DELIVERY' &&
        !(order.status === 'OUT_FOR_DELIVERY' && status === 'PROCESSING')
      : status !== 'OUT_FOR_DELIVERY'
  );
}

export const FULFILLMENT: Record<Fulfillment, string> = {
  STOCK: 'Pronta entrega',
  MADE_TO_ORDER: 'Sob encomenda',
  CAMPAIGN: 'Remessa (pré-venda)',
  DIGITAL: 'Digital (indisponível)',
  MEMBERSHIP: 'Afiliação (carteirinha)'
};

export const PRODUCT_STATUS: Record<ProductStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Rascunho', badge: '' },
  ACTIVE: { label: 'Publicado', badge: 'badge-success' },
  INACTIVE: { label: 'Oculto', badge: 'badge-warning' },
  SOLD_OUT: { label: 'Esgotado', badge: 'badge-danger' },
  ARCHIVED: { label: 'Excluído', badge: '' }
};

/** Cupons de desconto (DT-045). */
export type CouponDiscountType = 'PERCENTAGE' | 'FIXED';
export type CouponScope = 'ALL' | 'PRODUCTS' | 'CATEGORIES';
export type CouponAudience = 'EVERYONE' | 'LOGGED_IN' | 'ROLES';

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  percentage: string | null;
  amount: MoneyView | null;
  scope: CouponScope;
  audience: CouponAudience;
  minimumOrderAmount: MoneyView | null;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  maxPerCustomer: number | null;
  isActive: boolean;
  products: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  roles: { id: string; code: string; name: string }[];
  redemptions: number;
  totalDiscount: MoneyView;
  createdAt: string;
}

export interface CouponRedemption {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  discountAmount: MoneyView;
  status: 'ACTIVE' | 'RELEASED';
  createdAt: string;
}

export interface CouponPreview {
  code: string;
  subtotal: MoneyView;
  discount: MoneyView;
  total: MoneyView;
  eligibleSubtotal: MoneyView;
}

export const COUPON_SCOPE: Record<CouponScope, string> = {
  ALL: 'Todos os produtos do Fênix',
  PRODUCTS: 'Produtos escolhidos',
  CATEGORIES: 'Categorias escolhidas'
};

export const COUPON_AUDIENCE: Record<CouponAudience, string> = {
  EVERYONE: 'Qualquer pessoa',
  LOGGED_IN: 'Quem tem conta',
  ROLES: 'Públicos escolhidos (ex.: diretoria, atletas)'
};

/** Desistência e defeito (DT-070). */
export type ReturnStatus = 'OPEN' | 'AWAITING_ITEM' | 'REFUNDED' | 'RESOLVED' | 'REJECTED';

export const RETURN_STATUS: Record<ReturnStatus, { label: string; badge: string }> = {
  OPEN: { label: 'Aguardando a diretoria', badge: 'badge-warning' },
  AWAITING_ITEM: { label: 'Aguardando devolução do item', badge: 'badge-warning' },
  REFUNDED: { label: 'Estornado', badge: 'badge-success' },
  RESOLVED: { label: 'Resolvido', badge: 'badge-success' },
  REJECTED: { label: 'Recusado', badge: '' }
};

export const RETURN_RESOLUTION: Record<'REFUND' | 'EXCHANGE' | 'REPAIR', string> = {
  REFUND: 'Estorno',
  EXCHANGE: 'Troca',
  REPAIR: 'Conserto'
};

export interface ReturnView {
  id: string;
  orderId: string;
  orderNumber: string;
  kind: 'WITHDRAWAL' | 'DEFECT';
  status: ReturnStatus;
  description: string | null;
  resolution: 'REFUND' | 'EXCHANGE' | 'REPAIR' | null;
  response: string | null;
  refundAmount: MoneyView | null;
  items: { orderItemId: string; productName: string; quantity: number }[];
  customerName: string;
  createdAt: string;
  decidedAt: string | null;
}

export interface OrderRights {
  deliveryConfirmedAt: string | null;
  awaitingReceipt: boolean;
  withdrawalUntil: string | null;
  defectUntil: string | null;
  canWithdraw: boolean;
  canReportDefect: boolean;
  items: { orderItemId: string; productName: string; personalized: boolean; available: number }[];
  returns: ReturnView[];
}
