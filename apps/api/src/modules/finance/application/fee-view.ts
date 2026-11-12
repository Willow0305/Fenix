import { Injectable } from '@nestjs/common';
import type {
  MonthlyFeePlanStatus,
  MonthlyFeeStatus,
  Prisma
} from '../../../generated/prisma/client';
import { civilToDate, dateToCivil, monthStart, todayIn } from '../../../common/domain/civil-date';
import {
  type Money,
  money,
  type MoneyView,
  moneyView,
  sum,
  ZERO
} from '../../../common/domain/money';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import {
  effectiveFeeStatus,
  feeStatusAfterPayments,
  remainingAmount
} from '../domain/finance-rules';
import { PaymentsService, type PaymentView } from './payments.service';

export interface PlanView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly amount: MoneyView;
  readonly dueDay: number;
  readonly status: MonthlyFeePlanStatus;
  readonly activeAthletes: number;
}

/** Efeitos ao inativar um plano (DT-066); ao excluir, os dois valem sempre. */
export interface PlanEndEffects {
  /** Cancela mensalidades do plano do mês atual em diante sem nenhum pagamento. */
  readonly cancelFutureFees?: boolean;
  /** Encerra hoje o vínculo dos atletas com o plano, para poderem receber outro. */
  readonly endAthletePlans?: boolean;
}

/** O que muda ao inativar ou excluir o plano, mostrado antes de confirmar. */
export interface PlanImpact {
  readonly activeAthletes: number;
  readonly cancellableFees: number;
  /** Mensalidades em aberto que continuam: meses passados (dívida real) ou com pagamento. */
  readonly keptOpenFees: number;
}

/** Mensalidade que pode ser cancelada junto com o plano: do mês atual em diante, sem pagamento. */
export function cancellablePlanFees(planId: string): Prisma.MonthlyFeeWhereInput {
  return {
    monthlyFeePlanId: planId,
    status: { in: ['OPEN', 'OVERDUE'] },
    referenceMonth: { gte: civilToDate(monthStart(todayIn())) },
    paymentAllocations: { none: {} }
  };
}

export interface AthletePlanView {
  readonly id: string;
  readonly plan: { id: string; name: string };
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly amountOverride: MoneyView | null;
  readonly effectiveAmount: MoneyView;
  readonly status: string;
}

/** Atleta no plano (tela do plano, docs/29 COR-021). */
export interface PlanMemberView {
  readonly id: string;
  readonly athlete: { id: string; fullName: string; status: string };
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly amountOverride: MoneyView | null;
  readonly effectiveAmount: MoneyView;
  readonly status: string;
}

export interface BulkAssignResult {
  readonly assigned: number;
  /** Atletas que já tinham este plano ou outro (sem `replaceCurrent`). */
  readonly skipped: { athleteId: string; fullName: string; reason: string }[];
}

export type PlanRow = NonNullable<Awaited<ReturnType<PrismaTx['monthlyFeePlan']['findFirst']>>>;

export interface FeeView {
  readonly id: string;
  readonly athlete: { id: string; fullName: string };
  readonly plan: { id: string; name: string };
  readonly referenceMonth: string;
  readonly dueDate: string;
  readonly originalAmount: MoneyView;
  readonly discountAmount: MoneyView;
  readonly additionalAmount: MoneyView;
  readonly totalAmount: MoneyView;
  readonly paidAmount: MoneyView;
  readonly pendingAmount: MoneyView;
  readonly remainingAmount: MoneyView;
  readonly status: MonthlyFeeStatus;
  readonly cancellationReason: string | null;
  readonly notes: string | null;
}

export interface FeeDetail extends FeeView {
  readonly payments: PaymentView[];
}

export interface FeeFilters extends PageQueryDto {
  readonly referenceMonth?: string;
  readonly athleteId?: string;
  readonly teamId?: string;
  readonly status?: MonthlyFeeStatus;
}

export const FEE_INCLUDE = {
  athlete: { select: { id: true, fullName: true, userId: true } },
  monthlyFeePlan: { select: { id: true, name: true } },
  paymentAllocations: {
    select: { allocatedAmount: true, payment: { select: { id: true, status: true } } }
  }
} satisfies Prisma.MonthlyFeeInclude;

export type FeeRow = Prisma.MonthlyFeeGetPayload<{ include: typeof FEE_INCLUDE }>;

export function paidOf(row: FeeRow): { confirmed: Money; pending: Money } {
  return {
    confirmed: sum(
      row.paymentAllocations
        .filter((a) => a.payment.status === 'CONFIRMED')
        .map((a) => a.allocatedAmount)
    ),
    pending: sum(
      row.paymentAllocations
        .filter((a) => a.payment.status === 'PENDING')
        .map((a) => a.allocatedAmount)
    )
  };
}

export function monthOf(referenceMonth: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth)) {
    throw AppError.validation('INVALID_MONTH', 'Mês de referência inválido (AAAA-MM).');
  }

  return `${referenceMonth}-01`;
}

/**
 * Leitura de mensalidades (RF-012): visão da cobrança, listas, a própria cobrança do atleta e o
 * resumo em aberto. Também recalcula a situação a partir dos pagamentos (PEN-077).
 */
@Injectable()
export class FeeReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService
  ) {}

  private toView(row: FeeRow, today: string): FeeView {
    const { confirmed, pending } = paidOf(row);

    return {
      id: row.id,
      athlete: { id: row.athlete.id, fullName: row.athlete.fullName },
      plan: row.monthlyFeePlan,
      referenceMonth: dateToCivil(row.referenceMonth).slice(0, 7),
      dueDate: dateToCivil(row.dueDate),
      originalAmount: moneyView(row.originalAmount, row.currency),
      discountAmount: moneyView(row.discountAmount, row.currency),
      additionalAmount: moneyView(row.additionalAmount, row.currency),
      totalAmount: moneyView(row.totalAmount, row.currency),
      paidAmount: moneyView(confirmed, row.currency),
      pendingAmount: moneyView(pending, row.currency),
      remainingAmount: moneyView(remainingAmount(row.totalAmount, confirmed), row.currency),
      status: effectiveFeeStatus(row.status, dateToCivil(row.dueDate), today),
      cancellationReason: row.cancellationReason,
      notes: row.notes
    };
  }

  async list(filters: FeeFilters): Promise<Page<FeeView>> {
    const { skip, take, page, pageSize } = pageArgs(filters);
    const today = todayIn();
    const search = filters.search?.trim();
    const statusWhere: Prisma.MonthlyFeeWhereInput =
      filters.status === 'OVERDUE'
        ? { status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueDate: { lt: civilToDate(today) } }
        : filters.status === 'OPEN' || filters.status === 'PARTIALLY_PAID'
          ? { status: filters.status, dueDate: { gte: civilToDate(today) } }
          : filters.status
            ? { status: filters.status }
            : {};
    const where: Prisma.MonthlyFeeWhereInput = {
      ...statusWhere,
      ...(filters.referenceMonth
        ? { referenceMonth: civilToDate(monthOf(filters.referenceMonth)) }
        : {}),
      ...(filters.athleteId ? { athleteId: filters.athleteId } : {}),
      ...(filters.teamId
        ? {
            athlete: {
              teamMemberships: { some: { teamId: filters.teamId, status: 'ACTIVE', endsOn: null } }
            }
          }
        : {}),
      ...(search ? { athlete: { fullName: { contains: search, mode: 'insensitive' } } } : {})
    };
    const [rows, total, totals] = await this.prisma.$transaction([
      this.prisma.monthlyFee.findMany({
        where,
        include: FEE_INCLUDE,
        orderBy: [{ dueDate: 'desc' }, { athlete: { fullName: 'asc' } }],
        skip,
        take
      }),
      this.prisma.monthlyFee.count({ where }),
      this.prisma.monthlyFee.aggregate({ where, _sum: { totalAmount: true } })
    ]);

    return {
      ...toPage(
        rows.map((row) => this.toView(row, today)),
        total,
        page,
        pageSize
      ),
      totals: { amount: moneyView(totals._sum.totalAmount ?? ZERO) }
    } as Page<FeeView>;
  }

  async loadRow(tx: PrismaTx, id: string): Promise<FeeRow> {
    const row = await tx.monthlyFee.findUnique({ where: { id }, include: FEE_INCLUDE });

    if (row === null) {
      throw AppError.notFound('Mensalidade não encontrada.');
    }

    return row;
  }

  async get(id: string, ownerUserId?: string): Promise<FeeDetail> {
    const row = await this.loadRow(this.prisma, id);

    if (ownerUserId !== undefined && row.athlete.userId !== ownerUserId) {
      throw AppError.notFound('Mensalidade não encontrada.');
    }

    const ids = row.paymentAllocations.map((a) => a.payment.id);
    const views = await this.payments.views(ids);
    const payments = ids.flatMap((paymentId) => views.get(paymentId) ?? []);

    return { ...this.toView(row, todayIn()), payments };
  }

  /** Recalcula status armazenado a partir dos pagamentos confirmados (DT-027). */
  async refreshStatus(
    tx: PrismaTx,
    feeId: string
  ): Promise<{ before: MonthlyFeeStatus; after: MonthlyFeeStatus; row: FeeRow }> {
    const row = await this.loadRow(tx, feeId);

    if (row.status === 'CANCELLED') {
      return { before: row.status, after: row.status, row };
    }

    const { confirmed } = paidOf(row);
    const next = feeStatusAfterPayments(row.totalAmount, confirmed);

    if (next !== row.status) {
      await tx.monthlyFee.update({ where: { id: feeId }, data: { status: next } });
    }

    return { before: row.status, after: next, row };
  }

  async mine(userId: string): Promise<FeeView[]> {
    const rows = await this.prisma.monthlyFee.findMany({
      where: { athlete: { userId, deletedAt: null }, status: { not: 'CANCELLED' } },
      include: FEE_INCLUDE,
      orderBy: { referenceMonth: 'desc' },
      take: 36
    });
    const today = todayIn();

    return rows.map((row) => this.toView(row, today));
  }

  /** Totais para o painel (RF-020). */
  async openSummary(): Promise<{ count: number; amount: Money; overdue: number }> {
    const today = civilToDate(todayIn());
    const [open, overdue] = await this.prisma.$transaction([
      this.prisma.monthlyFee.aggregate({
        where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
        _count: true,
        _sum: { totalAmount: true }
      }),
      this.prisma.monthlyFee.count({
        where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueDate: { lt: today } }
      })
    ]);

    return { count: open._count, amount: money(open._sum.totalAmount ?? ZERO), overdue };
  }
}
