import type { MoneyView } from './finance-types';

/** Entrega em casa (DT-075). */
export type OrderFulfillment = 'PICKUP' | 'DELIVERY';

export interface DeliveryZone {
  id: string;
  name: string;
  fee: MoneyView;
  leadDays: number;
  isActive: boolean;
  neighborhoods: { id: string; name: string }[];
}

export interface DeliveryOptions {
  enabled: boolean;
  city: string;
  state: string;
  freeMinimum: MoneyView | null;
  zones: DeliveryZone[];
}

export interface DeliveryAdmin extends DeliveryOptions {
  /** Ligada na configuração (pode estar sem região ativa). */
  configuredEnabled: boolean;
}

/** Cópia do endereço guardada no pedido. */
export interface DeliveryAddress {
  postalCode: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  reference: string | null;
  phone: string | null;
  zoneName: string;
  leadDays: number;
}

export interface SavedAddress {
  id: string;
  label: string | null;
  postalCode: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhoodId: string | null;
  neighborhood: string;
  city: string;
  state: string;
  reference: string | null;
  phone: string | null;
  isDefault: boolean;
  /** Bairro ainda atendido. */
  served: boolean;
}

/** Endereço digitado no checkout ou em "Meus endereços". */
export interface AddressForm {
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhoodId: string;
  reference: string;
  phone: string;
}

export const EMPTY_ADDRESS: AddressForm = {
  postalCode: '',
  street: '',
  number: '',
  complement: '',
  neighborhoodId: '',
  reference: '',
  phone: ''
};

/** Só os campos preenchidos, como a API espera. */
export function addressBody(form: AddressForm): Record<string, string> {
  return Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim() !== ''));
}

/** "Rua X, 10, casa 2 — Centro, Rio Branco/AC". */
export function addressLine(address: {
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
}): string {
  const street = [address.street, address.number, address.complement].filter(Boolean).join(', ');

  return `${street} — ${address.neighborhood}, ${address.city}/${address.state}`;
}

/** Zona do bairro escolhido (taxa e prazo). */
export function zoneOf(options: DeliveryOptions, neighborhoodId: string): DeliveryZone | null {
  return (
    options.zones.find((zone) => zone.neighborhoods.some((n) => n.id === neighborhoodId)) ?? null
  );
}

/** Taxa na tela (a API recalcula no pedido): zero quando os produtos chegam ao frete grátis. */
export function previewFee(
  options: DeliveryOptions,
  zone: DeliveryZone | null,
  productsTotal: string
): number | null {
  if (zone === null) {
    return null;
  }

  if (options.freeMinimum && Number(productsTotal) >= Number(options.freeMinimum.amount)) {
    return 0;
  }

  return Number(zone.fee.amount);
}

// ---------- Comprovante de entrega (DT-075, etapa 2) ----------

export type CourierKind = 'STAFF' | 'OWN_COURIER' | 'APP';
export type DeliveryProofKind = 'CODE' | 'BUYER_RECEIPT' | 'PHOTO' | 'STAFF_ONLY';

export const COURIER_KIND: Record<CourierKind, string> = {
  STAFF: 'Diretoria',
  OWN_COURIER: 'Motoboy',
  APP: 'Aplicativo de entrega'
};

/** Prova da entrega, da mais forte para a mais fraca (RN-ENT-006). */
export const PROOF_KIND: Record<DeliveryProofKind, { label: string; badge: string }> = {
  CODE: { label: 'Código do comprador', badge: 'badge-success' },
  BUYER_RECEIPT: { label: '"Recebi" do comprador', badge: 'badge-success' },
  PHOTO: { label: 'Foto da entrega', badge: 'badge-info' },
  STAFF_ONLY: { label: 'Só marcada pela diretoria', badge: 'badge-warning' }
};

export interface Courier {
  id: string;
  name: string;
  kind: CourierKind;
  phone: string | null;
  vehicle: string | null;
  plate: string | null;
  isActive: boolean;
}

/** Saída para entrega (painel; nunca com o código do comprador). */
export interface DeliveryAttempt {
  id: string;
  status: 'OUT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  courierKind: CourierKind | null;
  courierName: string | null;
  courierPhone: string | null;
  vehicle: string | null;
  plate: string | null;
  notes: string | null;
  linkActive: boolean;
  linkExpiresAt: string | null;
  codeAttempts: number;
  receivedBy: string | null;
  hasPhoto: boolean;
  failureReason: string | null;
  dispatchedBy: string | null;
  dispatchedAt: string;
  finishedAt: string | null;
}

export const ATTEMPT_STATUS: Record<DeliveryAttempt['status'], { label: string; badge: string }> = {
  OUT: { label: 'A caminho', badge: 'badge-info' },
  DELIVERED: { label: 'Entregue', badge: 'badge-success' },
  FAILED: { label: 'Sem sucesso', badge: 'badge-warning' },
  CANCELLED: { label: 'Cancelada', badge: '' }
};

/** O que o entregador vê pelo link. */
export interface CourierLink {
  orderNumber: string;
  customerFirstName: string | null;
  address: {
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string;
    city: string;
    state: string;
    reference: string | null;
    phone: string | null;
  } | null;
  status: 'OUT' | 'DONE' | 'CLOSED';
  codeAttemptsLeft: number;
  expiresAt: string | null;
}

/** Texto pronto para mandar o link ao entregador pelo WhatsApp. */
export function courierMessage(orderNumber: string, link: string): string {
  return `Entrega do pedido ${orderNumber} (Fênix Vôlei). Abra o link para ver o endereço e, na entrega, digite o código que o cliente informar ou tire uma foto: ${link}`;
}
