import type { MoneyView } from './finance-types';
import type { OrderStatus } from './store-types';

export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'OPEN'
  | 'CLOSED'
  | 'ORDERED'
  | 'IN_PRODUCTION'
  | 'RECEIVED'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CampaignProduct {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  image: string | null;
  campaignPrice: MoneyView | null;
  minimumQuantity: number | null;
  maximumQuantity: number | null;
  soldQuantity: number;
  isActive: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: CampaignStatus;
  salesStartAt: string;
  salesEndAt: string;
  minimumQuantity: number | null;
  maximumQuantity: number | null;
  paidQuantity: number;
  reservedQuantity: number;
  supplierOrderedOn: string | null;
  expectedProductionOn: string | null;
  expectedArrivalOn: string | null;
  receivedOn: string | null;
  pickupStartsOn: string | null;
  pickupEndsOn: string | null;
  refundPolicy: string | null;
  cancellationReason: string | null;
  supplier: { id: string; name: string } | null;
  products: CampaignProduct[];
}

export interface CampaignReport {
  campaign: { id: string; name: string; status: CampaignStatus };
  generatedAt: string;
  lines: {
    productId: string;
    productName: string;
    variantName: string;
    sku: string;
    quantity: number;
  }[];
  totalQuantity: number;
  orders: {
    orderNumber: string;
    customerName: string;
    customerPhone: string | null;
    status: OrderStatus;
    items: string;
    pickedUp: boolean;
  }[];
}

export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Rascunho', badge: '' },
  SCHEDULED: { label: 'Agendada', badge: 'badge-info' },
  OPEN: { label: 'Vendas abertas', badge: 'badge-success' },
  CLOSED: { label: 'Vendas encerradas', badge: 'badge-warning' },
  ORDERED: { label: 'Encomendada', badge: 'badge-info' },
  IN_PRODUCTION: { label: 'Em produção', badge: 'badge-info' },
  RECEIVED: { label: 'Recebida', badge: 'badge-brand' },
  READY_FOR_PICKUP: { label: 'Pronta para retirada', badge: 'badge-brand' },
  COMPLETED: { label: 'Concluída', badge: 'badge-success' },
  CANCELLED: { label: 'Cancelada', badge: 'badge-danger' }
};

export const CAMPAIGN_NEXT: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ['OPEN', 'SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['OPEN', 'CANCELLED'],
  OPEN: ['CLOSED', 'CANCELLED'],
  CLOSED: ['ORDERED', 'OPEN', 'CANCELLED'],
  ORDERED: ['IN_PRODUCTION', 'RECEIVED', 'CANCELLED'],
  IN_PRODUCTION: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['READY_FOR_PICKUP'],
  READY_FOR_PICKUP: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: []
};
