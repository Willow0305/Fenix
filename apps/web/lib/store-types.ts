import type { MoneyView, Payment } from './finance-types';

export type Fulfillment = 'STOCK' | 'MADE_TO_ORDER' | 'CAMPAIGN' | 'DIGITAL';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'SOLD_OUT' | 'ARCHIVED';
export type OrderStatus =
  | 'CREATED'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'READY_FOR_PICKUP'
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
  warning: 'UNAVAILABLE' | 'INSUFFICIENT_STOCK' | null;
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
  cancelledAt: string | null;
  cancellationReason: string | null;
  reservationExpiresAt: string | null;
  paymentInfo?: { pixKey: string | null; bankingDetails: string | null };
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; badge: string }> = {
  CREATED: { label: 'Criado', badge: '' },
  AWAITING_PAYMENT: { label: 'Aguardando pagamento', badge: 'badge-warning' },
  PAID: { label: 'Pago', badge: 'badge-success' },
  PROCESSING: { label: 'Em separação', badge: 'badge-info' },
  READY_FOR_PICKUP: { label: 'Pronto para retirada', badge: 'badge-brand' },
  DELIVERED: { label: 'Entregue', badge: 'badge-success' },
  CANCELLED: { label: 'Cancelado', badge: '' },
  REFUNDED: { label: 'Reembolsado', badge: 'badge-danger' }
};

export const ORDER_NEXT: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ['CANCELLED'],
  AWAITING_PAYMENT: ['CANCELLED'],
  PAID: ['PROCESSING', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED'],
  PROCESSING: ['READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED'],
  READY_FOR_PICKUP: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: []
};

export const FULFILLMENT: Record<Fulfillment, string> = {
  STOCK: 'Pronta entrega',
  MADE_TO_ORDER: 'Sob encomenda',
  CAMPAIGN: 'Remessa (pré-venda)',
  DIGITAL: 'Digital (indisponível)'
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
