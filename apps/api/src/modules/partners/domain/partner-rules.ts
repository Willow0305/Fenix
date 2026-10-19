import type {
  AppointmentStatus,
  CommissionType,
  PartnerSettlementStatus,
  PartnerStatus,
  Prisma,
  ServiceStatus
} from '@prisma/client';

import { civilToDate } from '../../../common/domain/civil-date';
import { type Money, money, round2, ZERO } from '../../../common/domain/money';
import type { TransitionTable } from '../../../common/domain/state-machine';

/** Regras puras de parceiros, comissões, repasses e agenda (RF-031 a RF-034, DT-033). */

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  PENDING: 'Em análise',
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  ENDED: 'Encerrado'
};

/** `ENDED` é terminal: o histórico de vendas e repasses permanece consultável. */
export const PARTNER_TRANSITIONS: TransitionTable<PartnerStatus> = {
  PENDING: ['ACTIVE', 'ENDED'],
  ACTIVE: ['INACTIVE', 'ENDED'],
  INACTIVE: ['ACTIVE', 'ENDED']
};

export interface ContractWindow {
  readonly status: PartnerStatus;
  readonly deletedAt: Date | null;
  readonly contractStartsOn: Date | null;
  readonly contractEndsOn: Date | null;
}

/**
 * RN-PAR-001: só parceiro ativo e dentro da vigência do contrato é publicado e vende.
 * `today` é a data civil no fuso do time.
 */
export function partnerOperational(partner: ContractWindow, today: string): boolean {
  const day = civilToDate(today);

  return (
    partner.status === 'ACTIVE' &&
    partner.deletedAt === null &&
    (partner.contractStartsOn === null || partner.contractStartsOn <= day) &&
    (partner.contractEndsOn === null || partner.contractEndsOn >= day)
  );
}

/** Mesmo critério de `partnerOperational`, como filtro do Prisma. */
export function operationalPartnerWhere(today: string): Prisma.PartnerWhereInput {
  const day = civilToDate(today);

  return {
    status: 'ACTIVE',
    deletedAt: null,
    AND: [
      { OR: [{ contractStartsOn: null }, { contractStartsOn: { lte: day } }] },
      { OR: [{ contractEndsOn: null }, { contractEndsOn: { gte: day } }] }
    ]
  };
}

export interface CommissionRule {
  readonly type: CommissionType;
  /** Percentual de 0 a 100 retido pelo time. */
  readonly percentage: Money | null;
  /** Valor fixo retido pelo time por unidade vendida. */
  readonly fixedAmount: Money | null;
}

export interface CommissionSource {
  readonly commissionType: CommissionType;
  readonly commissionPercentage: Money | null;
  readonly commissionFixedAmount: Money | null;
}

export interface CommissionOverride {
  readonly commissionTypeOverride: CommissionType | null;
  readonly commissionPercentageOverride: Money | null;
  readonly commissionFixedOverride: Money | null;
}

/** O produto pode sobrepor a regra do parceiro (PEN-035, DT-033). */
export function effectiveCommission(
  partner: CommissionSource,
  product: CommissionOverride
): CommissionRule {
  if (product.commissionTypeOverride !== null) {
    return {
      type: product.commissionTypeOverride,
      percentage: product.commissionPercentageOverride,
      fixedAmount: product.commissionFixedOverride
    };
  }

  return {
    type: partner.commissionType,
    percentage: partner.commissionPercentage,
    fixedAmount: partner.commissionFixedAmount
  };
}

/** Valida a coerência de uma regra informada pela diretoria. Retorna mensagem ou `null`. */
export function invalidCommission(rule: CommissionRule): string | null {
  if (rule.type === 'PERCENTAGE') {
    if (
      rule.percentage === null ||
      rule.percentage.lessThan(0) ||
      rule.percentage.greaterThan(100)
    ) {
      return 'Informe um percentual de comissão entre 0 e 100.';
    }
  }

  if (rule.type === 'FIXED' && (rule.fixedAmount === null || rule.fixedAmount.lessThan(0))) {
    return 'Informe o valor fixo de comissão por unidade.';
  }

  return null;
}

export interface CommissionSplit {
  readonly commission: Money;
  readonly partnerAmount: Money;
}

/**
 * RN-PAR-002/003: separa a parte do time (comissão) e o valor devido ao parceiro.
 * A comissão nunca excede o total do item; arredondamento comercial em 2 casas.
 */
export function splitCommission(
  rule: CommissionRule,
  total: Money,
  quantity: number
): CommissionSplit {
  let commission = ZERO;

  if (rule.type === 'PERCENTAGE' && rule.percentage !== null) {
    commission = round2(total.times(rule.percentage).dividedBy(100));
  }

  if (rule.type === 'FIXED' && rule.fixedAmount !== null) {
    commission = round2(rule.fixedAmount.times(quantity));
  }

  if (commission.greaterThan(total)) {
    commission = total;
  }

  return { commission, partnerAmount: total.minus(commission) };
}

export const SETTLEMENT_STATUS_LABELS: Record<PartnerSettlementStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  PAID: 'Pago',
  CANCELLED: 'Cancelado'
};

/** `PAID` só é alcançado pelo pagamento, que lança a saída no Caixa. */
export const SETTLEMENT_TRANSITIONS: TransitionTable<PartnerSettlementStatus> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['PAID', 'CANCELLED']
};

export interface SettlementLine {
  readonly gross: Money;
  readonly commission: Money;
}

export interface SettlementTotals {
  readonly gross: Money;
  readonly commission: Money;
  readonly net: Money;
}

/** Líquido = bruto − comissão + ajuste (ajuste pode ser negativo, sempre motivado). */
export function settlementTotals(
  lines: readonly SettlementLine[],
  adjustment: Money = ZERO
): SettlementTotals {
  const gross = lines.reduce<Money>((total, line) => total.plus(line.gross), ZERO);
  const commission = lines.reduce<Money>((total, line) => total.plus(line.commission), ZERO);

  return { gross, commission, net: gross.minus(commission).plus(adjustment) };
}

export const SERVICE_TRANSITIONS: TransitionTable<ServiceStatus> = {
  DRAFT: ['ACTIVE', 'INACTIVE'],
  ACTIVE: ['INACTIVE'],
  INACTIVE: ['ACTIVE']
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  REQUESTED: 'Solicitado',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Realizado',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu'
};

/** RN-PAR-006: solicitação não é confirmação; a diretoria confirma ou cancela. */
export const APPOINTMENT_TRANSITIONS: TransitionTable<AppointmentStatus> = {
  REQUESTED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED']
};

export interface Interval {
  readonly startsAt: Date;
  readonly endsAt: Date;
}

/** Intervalos semiabertos `[início, fim)`: encostar não é sobrepor. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

export function invalidInterval(interval: Interval, now: Date): string | null {
  if (interval.startsAt >= interval.endsAt) {
    return 'O início deve ser anterior ao fim.';
  }

  if (interval.endsAt <= now) {
    return 'O horário precisa estar no futuro.';
  }

  if (interval.endsAt.getTime() - interval.startsAt.getTime() > 12 * 3_600_000) {
    return 'Cada intervalo pode ter no máximo 12 horas.';
  }

  return null;
}

/** O intervalo comporta a duração do serviço? */
export function fitsDuration(interval: Interval, durationMinutes: number): boolean {
  return interval.endsAt.getTime() - interval.startsAt.getTime() >= durationMinutes * 60_000;
}

/** Percentual da API (string) para Decimal, aceitando até 4 casas. */
export function parsePercentage(value: string): Money {
  return money(value).toDecimalPlaces(4);
}
