import type { SalesCampaignStatus } from '@prisma/client';

import type { TransitionTable } from '../../../common/domain/state-machine';

/** Regras puras de remessas/campanhas (RF-036, RCF-009, PEN-031/032, DT-032). */

export const CAMPAIGN_STATUS_LABELS: Record<SalesCampaignStatus, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendada',
  OPEN: 'Vendas abertas',
  CLOSED: 'Vendas encerradas',
  ORDERED: 'Encomendada ao fornecedor',
  IN_PRODUCTION: 'Em produção',
  RECEIVED: 'Recebida',
  READY_FOR_PICKUP: 'Pronta para retirada',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada'
};

export const CAMPAIGN_TRANSITIONS: TransitionTable<SalesCampaignStatus> = {
  DRAFT: ['SCHEDULED', 'OPEN', 'CANCELLED'],
  SCHEDULED: ['OPEN', 'CANCELLED'],
  OPEN: ['CLOSED', 'CANCELLED'],
  CLOSED: ['OPEN', 'ORDERED', 'CANCELLED'],
  ORDERED: ['IN_PRODUCTION', 'RECEIVED', 'CANCELLED'],
  IN_PRODUCTION: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['READY_FOR_PICKUP'],
  READY_FOR_PICKUP: ['COMPLETED']
};

/** Estados em que a configuração de produtos e janela ainda pode mudar. */
export function isEditable(status: SalesCampaignStatus): boolean {
  return status === 'DRAFT' || status === 'SCHEDULED' || status === 'OPEN' || status === 'CLOSED';
}

export interface CampaignWindow {
  readonly salesStartAt: Date;
  readonly salesEndAt: Date;
}

export function assertWindow(window: CampaignWindow): string | null {
  return window.salesStartAt >= window.salesEndAt
    ? 'O início das vendas deve ser anterior ao encerramento.'
    : null;
}

/** Abrir/reabrir exige encerramento no futuro (extensão de prazo, PEN-031). */
export function canOpen(window: CampaignWindow, now: Date): boolean {
  return window.salesEndAt > now;
}

export interface MinimumCheck {
  readonly minimumQuantity: number | null;
  readonly paidQuantity: number;
}

/** Encomendar ao fornecedor só se o mínimo pago foi atingido (RN-REM-004). */
export function minimumReached(check: MinimumCheck): boolean {
  return check.minimumQuantity === null || check.paidQuantity >= check.minimumQuantity;
}

export interface ConsolidationLine {
  readonly productId: string;
  readonly productName: string;
  readonly variantName: string;
  readonly sku: string;
  readonly quantity: number;
}

/** Agrupa itens por SKU para o relatório da malharia (RN-REM-003). */
export function consolidate(lines: readonly ConsolidationLine[]): ConsolidationLine[] {
  const bySku = new Map<string, ConsolidationLine>();

  for (const line of lines) {
    const current = bySku.get(line.sku);

    bySku.set(
      line.sku,
      current ? { ...current, quantity: current.quantity + line.quantity } : { ...line }
    );
  }

  return [...bySku.values()].sort(
    (a, b) =>
      a.productName.localeCompare(b.productName, 'pt-BR') ||
      a.variantName.localeCompare(b.variantName, 'pt-BR')
  );
}

/** CSV com separador ";" (padrão de planilhas pt-BR) e escape de aspas. */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number)[])[]
): string {
  const escape = (value: string | number): string => {
    const text = String(value);

    return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };

  return [header, ...rows].map((row) => row.map(escape).join(';')).join('\n');
}
