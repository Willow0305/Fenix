import type { MoneyView } from './finance-types';

export type PartnerType = 'SUPPLIER' | 'STORE' | 'PROFESSIONAL' | 'SPONSOR' | 'OTHER';
export type PartnerStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'ENDED';
export type CommissionType = 'NONE' | 'PERCENTAGE' | 'FIXED';
export type ServiceStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type AppointmentStatus = 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type SettlementStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';

export interface PartnerDocument {
  id: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  issuedOn: string | null;
  expiresOn: string | null;
  createdAt: string;
}

export interface Partner {
  id: string;
  legalName: string;
  displayName: string;
  type: PartnerType;
  status: PartnerStatus;
  operational: boolean;
  documentNumberMasked: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
  websiteUrl: string | null;
  contractStartsOn: string | null;
  contractEndsOn: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  commissionType: CommissionType;
  commissionPercentage: string | null;
  commissionFixedAmount: MoneyView | null;
  contractNotes: string | null;
  counts: { products: number; professionals: number; services: number };
  documents?: PartnerDocument[];
  createdAt: string;
}

export interface Professional {
  id: string;
  partner: { id: string; name: string };
  fullName: string;
  profession: string;
  hasLicense: boolean;
  email: string | null;
  phone: string | null;
  publicBio: string | null;
  publicContact: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface PartnerService {
  id: string;
  partner: { id: string; name: string };
  professional: { id: string; fullName: string } | null;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: MoneyView | null;
  status: ServiceStatus;
}

export interface Availability {
  id: string;
  professionalId: string;
  serviceId: string | null;
  startsAt: string;
  endsAt: string;
  status: 'AVAILABLE' | 'BLOCKED' | 'RESERVED';
  notes: string | null;
  appointmentId: string | null;
}

export interface Appointment {
  id: string;
  status: AppointmentStatus;
  service: { id: string; name: string; durationMinutes: number };
  partner: { id: string; name: string };
  professional: { id: string; fullName: string } | null;
  requester: { id: string; name: string; email?: string; phone?: string | null };
  scheduledStartsAt: string | null;
  scheduledEndsAt: string | null;
  quotedPrice: MoneyView | null;
  requesterNotes: string | null;
  administrativeNotes?: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

export interface SettlementItem {
  id: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  quantity: number;
  paidAt: string | null;
  gross: MoneyView;
  commission: MoneyView;
  net: MoneyView;
  orderStatus: string;
}

export interface Settlement {
  id: string;
  partner: { id: string; name: string };
  periodStart: string;
  periodEnd: string;
  status: SettlementStatus;
  grossSalesAmount: MoneyView;
  commissionAmount: MoneyView;
  adjustmentAmount: MoneyView;
  adjustmentReason: string | null;
  netPayableAmount: MoneyView;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  transactionId: string | null;
  itemCount: number;
  items?: SettlementItem[];
  createdAt: string;
}

export interface PartnerSalesReport {
  from: string;
  to: string;
  timeZone: string;
  lines: {
    partner: { id: string; name: string };
    itemCount: number;
    quantity: number;
    gross: MoneyView;
    teamRevenue: MoneyView;
    partnerAmount: MoneyView;
    settledAmount: MoneyView;
    paidOutAmount: MoneyView;
    pendingAmount: MoneyView;
  }[];
  totals: { gross: MoneyView; teamRevenue: MoneyView; partnerAmount: MoneyView };
}

export interface PublicPartner {
  id: string;
  displayName: string;
  type: PartnerType;
  description: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  professionals: {
    id: string;
    fullName: string;
    profession: string;
    publicBio: string | null;
    email: string | null;
    phone: string | null;
  }[];
  services: {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    price: MoneyView | null;
    professional: { id: string; fullName: string } | null;
  }[];
  products: { id: string; name: string; slug: string }[];
}

export const PARTNER_TYPE: Record<PartnerType, string> = {
  SUPPLIER: 'Fornecedor',
  STORE: 'Loja',
  PROFESSIONAL: 'Profissional / clínica',
  SPONSOR: 'Patrocinador',
  OTHER: 'Outro'
};

export const PARTNER_STATUS: Record<PartnerStatus, { label: string; badge: string }> = {
  PENDING: { label: 'Em análise', badge: 'badge-warning' },
  ACTIVE: { label: 'Ativo', badge: 'badge-success' },
  INACTIVE: { label: 'Inativo', badge: '' },
  ENDED: { label: 'Encerrado', badge: 'badge-danger' }
};

export const PARTNER_NEXT: Record<PartnerStatus, PartnerStatus[]> = {
  PENDING: ['ACTIVE', 'ENDED'],
  ACTIVE: ['INACTIVE', 'ENDED'],
  INACTIVE: ['ACTIVE', 'ENDED'],
  ENDED: []
};

export const COMMISSION_TYPE: Record<CommissionType, string> = {
  NONE: 'Sem comissão (repasse integral)',
  PERCENTAGE: 'Percentual sobre a venda',
  FIXED: 'Valor fixo por unidade'
};

export const SERVICE_STATUS: Record<ServiceStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Rascunho', badge: '' },
  ACTIVE: { label: 'Ativo', badge: 'badge-success' },
  INACTIVE: { label: 'Inativo', badge: '' }
};

export const APPOINTMENT_STATUS: Record<AppointmentStatus, { label: string; badge: string }> = {
  REQUESTED: { label: 'Solicitado', badge: 'badge-warning' },
  CONFIRMED: { label: 'Confirmado', badge: 'badge-success' },
  COMPLETED: { label: 'Realizado', badge: 'badge-info' },
  CANCELLED: { label: 'Cancelado', badge: 'badge-danger' },
  NO_SHOW: { label: 'Não compareceu', badge: '' }
};

export const SETTLEMENT_STATUS: Record<SettlementStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Rascunho', badge: '' },
  PENDING: { label: 'Aguardando aprovação', badge: 'badge-warning' },
  APPROVED: { label: 'Aprovado', badge: 'badge-info' },
  PAID: { label: 'Pago', badge: 'badge-success' },
  CANCELLED: { label: 'Cancelado', badge: 'badge-danger' }
};

export function commissionLabel(
  type: CommissionType,
  percentage: string | null,
  fixed: MoneyView | null
): string {
  if (type === 'PERCENTAGE') {
    return `${(percentage ?? '0').replace('.', ',')}%`;
  }

  if (type === 'FIXED') {
    return `R$ ${(fixed?.amount ?? '0.00').replace('.', ',')} por unidade`;
  }

  return 'Sem comissão';
}
