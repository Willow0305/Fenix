import { PERMISSIONS } from '../../access/domain/permission-catalog';

/**
 * Onde um arquivo não público é usado. Vem das ligações do `MediaFile` com os domínios
 * que têm rota própria de leitura, cada uma com a sua permissão (PEN-054, DT-110).
 */
export interface MediaUsage {
  readonly partnerDocument: boolean;
  readonly athleteDocument: boolean;
  readonly transactionAttachment: boolean;
  readonly orderPaymentAttachment: boolean;
  readonly feePaymentAttachment: boolean;
  readonly deliveryProof: boolean;
}

export const NO_MEDIA_USAGE: MediaUsage = {
  partnerDocument: false,
  athleteDocument: false,
  transactionAttachment: false,
  orderPaymentAttachment: false,
  feePaymentAttachment: false,
  deliveryProof: false
};

/**
 * Permissões de domínio que a rota genérica `/media/:id` exige, além de
 * `files.read.restricted`, para um arquivo não público: as mesmas das rotas dedicadas.
 * Sem ligação de domínio (ex.: foto de perfil), basta `files.read.restricted`.
 */
export function domainPermissionsFor(usage: MediaUsage): string[] {
  const required = new Set<string>();

  if (usage.partnerDocument) {
    required.add(PERMISSIONS.partnerDocumentsRead);
  }

  if (usage.athleteDocument) {
    required.add(PERMISSIONS.athletesRead);
  }

  if (usage.transactionAttachment) {
    required.add(PERMISSIONS.financeRead);
  }

  if (usage.orderPaymentAttachment || usage.deliveryProof) {
    required.add(PERMISSIONS.ordersRead);
  }

  if (usage.feePaymentAttachment) {
    required.add(PERMISSIONS.feesRead);
  }

  return [...required].sort();
}

/** Quem tem `files.read.restricted` lê pela rota genérica só se tiver todas as do domínio. */
export function canReadRestrictedThroughGenericRoute(
  permissions: ReadonlySet<string>,
  usage: MediaUsage
): boolean {
  return (
    permissions.has(PERMISSIONS.filesReadRestricted) &&
    domainPermissionsFor(usage).every((permission) => permissions.has(permission))
  );
}
