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
