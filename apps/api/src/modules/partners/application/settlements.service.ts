import { Injectable } from '@nestjs/common';
import type {
  OrderStatus,
  PartnerSettlementStatus,
  Prisma
} from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { civilToDate, dateToCivil, optionalCivil } from '../../../common/domain/civil-date';
import {
  DEFAULT_CURRENCY,
  type Money,
  money,
  type MoneyView,
  moneyView,
  sum,
  ZERO
} from '../../../common/domain/money';
import { assertTransition } from '../../../common/domain/state-machine';
import { endOfDayExclusive, startOfDayInZone } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { LedgerService, lockRow } from '../../finance/application/ledger.service';
import { SYSTEM_CATEGORY } from '../../finance/domain/finance-catalog';
import {
  effectiveCommission,
  SETTLEMENT_STATUS_LABELS,
  SETTLEMENT_TRANSITIONS,
  settlementTotals,
  splitCommission
} from '../domain/partner-rules';

/** Pedidos pagos e não estornados: base de comissão e repasse (RN-PAR-003). */
export const PAID_ORDER_STATUSES: OrderStatus[] = [
  'PAID',
  'PROCESSING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED'
];

export interface SettlementItemView {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly productName: string;
  readonly quantity: number;
  readonly paidAt: string | null;
  readonly gross: MoneyView;
  readonly commission: MoneyView;
  readonly net: MoneyView;
  readonly orderStatus: OrderStatus;
}

export interface SettlementView {
  readonly id: string;
  readonly partner: { id: string; name: string };
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly status: PartnerSettlementStatus;
  readonly grossSalesAmount: MoneyView;
  readonly commissionAmount: MoneyView;
  readonly adjustmentAmount: MoneyView;
  readonly adjustmentReason: string | null;
  readonly netPayableAmount: MoneyView;
  readonly dueDate: string | null;
  readonly paidAt: string | null;
  readonly notes: string | null;
  readonly approvedAt: string | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
  readonly transactionId: string | null;
  readonly itemCount: number;
  readonly items?: SettlementItemView[];
  readonly createdAt: string;
}

export interface PartnerSalesLine {
  readonly partner: { id: string; name: string };
  readonly itemCount: number;
  readonly quantity: number;
  readonly gross: MoneyView;
  /** Receita do time (comissão). */
  readonly teamRevenue: MoneyView;
  /** Valor devido ao parceiro. */
  readonly partnerAmount: MoneyView;
  readonly settledAmount: MoneyView;
  readonly paidOutAmount: MoneyView;
  readonly pendingAmount: MoneyView;
}

export interface PartnerSalesReport {
  readonly from: string;
  readonly to: string;
  readonly timeZone: string;
  readonly lines: PartnerSalesLine[];
  readonly totals: { gross: MoneyView; teamRevenue: MoneyView; partnerAmount: MoneyView };
}

export interface SettlementFilters extends PageQueryDto {
  readonly status?: PartnerSettlementStatus;
  readonly partnerId?: string;
}

const SETTLEMENT_INCLUDE = {
  partner: { select: { id: true, displayName: true } },
  financialTransaction: { select: { id: true } },
  _count: { select: { items: true } }
} satisfies Prisma.PartnerSettlementInclude;

type SettlementRow = Prisma.PartnerSettlementGetPayload<{ include: typeof SETTLEMENT_INCLUDE }>;

const ITEM_INCLUDE = {
  order: { select: { id: true, orderNumber: true, paidAt: true, status: true } },
  partner: {
    select: { commissionType: true, commissionPercentage: true, commissionFixedAmount: true }
  },
  product: {
    select: {
      commissionTypeOverride: true,
      commissionPercentageOverride: true,
      commissionFixedOverride: true
    }
  }
} satisfies Prisma.OrderItemInclude;

type EligibleItem = Prisma.OrderItemGetPayload<{ include: typeof ITEM_INCLUDE }>;

/**
 * Parte do time e do parceiro de um item. Usa o snapshot gravado no checkout; itens
 * anteriores à Fase 6 (sem snapshot) usam a regra vigente, registrada no repasse.
 */
export function itemSplit(item: EligibleItem): { commission: Money; partnerAmount: Money } {
  if (item.partnerAmountSnapshot !== null) {
    return {
      commission: item.totalAmount.minus(item.partnerAmountSnapshot),
      partnerAmount: item.partnerAmountSnapshot
    };
  }

  if (item.partner === null) {
    return { commission: item.totalAmount, partnerAmount: ZERO };
  }

  return splitCommission(
    effectiveCommission(item.partner, item.product),
    item.totalAmount,
    item.quantity
  );
}

/** Repasses a parceiros (RCF-010, RN-PAR-003, PEN-035, DT-033). */
@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService
  ) {}

  private toView(row: SettlementRow, items?: SettlementItemView[]): SettlementView {
    return {
      id: row.id,
      partner: { id: row.partner.id, name: row.partner.displayName },
      periodStart: dateToCivil(row.periodStart),
      periodEnd: dateToCivil(row.periodEnd),
      status: row.status,
      grossSalesAmount: moneyView(row.grossSalesAmount, row.currency),
      commissionAmount: moneyView(row.commissionAmount, row.currency),
      adjustmentAmount: moneyView(row.adjustmentAmount, row.currency),
      adjustmentReason: row.adjustmentReason,
      netPayableAmount: moneyView(row.netPayableAmount, row.currency),
      dueDate: optionalCivil(row.dueDate),
      paidAt: row.paidAt?.toISOString() ?? null,
      notes: row.notes,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      cancellationReason: row.cancellationReason,
      transactionId: row.financialTransaction?.id ?? null,
      itemCount: row._count.items,
      ...(items ? { items } : {}),
      createdAt: row.createdAt.toISOString()
    };
  }

  async list(filters: SettlementFilters): Promise<Page<SettlementView>> {
    const { skip, take, page, pageSize } = pageArgs(filters);
    const where: Prisma.PartnerSettlementWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.partnerId ? { partnerId: filters.partnerId } : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.partnerSettlement.findMany({
        where,
        include: SETTLEMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      this.prisma.partnerSettlement.count({ where })
    ]);

    return toPage(
      rows.map((row) => this.toView(row)),
      total,
      page,
      pageSize
    );
  }

  async get(id: string): Promise<SettlementView> {
    const row = await this.prisma.partnerSettlement.findUnique({
      where: { id },
      include: SETTLEMENT_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Repasse não encontrado.');
    }

    const items = await this.prisma.partnerSettlementItem.findMany({
      where: { partnerSettlementId: id },
      include: {
        orderItem: {
          select: {
            productName: true,
            quantity: true,
            order: { select: { id: true, orderNumber: true, paidAt: true, status: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return this.toView(
      row,
      items.map((item) => ({
        id: item.id,
        orderId: item.orderItem.order.id,
        orderNumber: item.orderItem.order.orderNumber,
        productName: item.orderItem.productName,
        quantity: item.orderItem.quantity,
        paidAt: item.orderItem.order.paidAt?.toISOString() ?? null,
        gross: moneyView(item.grossAmount, item.currency),
        commission: moneyView(item.commissionAmount, item.currency),
        net: moneyView(item.netAmount, item.currency),
        orderStatus: item.orderItem.order.status
      }))
    );
  }

  private eligibleWhere(partnerId: string, from: string, to: string): Prisma.OrderItemWhereInput {
    return {
      partnerId,
      settlementItem: null,
      order: {
        status: { in: PAID_ORDER_STATUSES },
        paidAt: { gte: startOfDayInZone(from), lt: endOfDayExclusive(to) }
      }
    };
  }

  /**
   * Cria repasse em rascunho com os itens pagos e ainda não repassados do período.
   * Idempotente pela chave do cliente; a trava no parceiro impede que dois repasses
   * concorrentes peguem o mesmo item (que também é único no banco).
   */
  async create(
    actor: Principal,
    partnerId: string,
    input: {
      periodStart: string;
      periodEnd: string;
      dueDate?: string;
      notes?: string;
      adjustmentAmount?: Money;
      adjustmentReason?: string;
    },
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<SettlementView> {
    if (input.periodEnd < input.periodStart) {
      throw AppError.validation('INVALID_PERIOD', 'O fim do período deve ser após o início.');
    }

    const adjustment = input.adjustmentAmount ?? ZERO;

    if (!adjustment.isZero() && !input.adjustmentReason) {
      throw AppError.validation('REASON_REQUIRED', 'Informe o motivo do ajuste.');
    }

    const key = `settlement:${idempotencyKey}`;
    const id = await this.prisma.$transaction(
      async (tx) => {
        const replay = await tx.partnerSettlement.findUnique({
          where: { idempotencyKey: key },
          select: { id: true, createdById: true }
        });

        if (replay) {
          if (replay.createdById !== actor.userId) {
            throw AppError.conflict('IDEMPOTENCY_CONFLICT', 'Chave de idempotência já utilizada.');
          }

          return replay.id;
        }

        await lockRow(tx, 'partner', partnerId);
        const partner = await tx.partner.findFirst({
          where: { id: partnerId, deletedAt: null },
          select: { id: true }
        });

        if (partner === null) {
          throw AppError.notFound('Parceiro não encontrado.');
        }

        const items = await tx.orderItem.findMany({
          where: this.eligibleWhere(partnerId, input.periodStart, input.periodEnd),
          include: ITEM_INCLUDE,
          orderBy: { createdAt: 'asc' }
        });

        if (items.length === 0) {
          throw AppError.validation(
            'NOTHING_TO_SETTLE',
            'Não há vendas pagas e ainda não repassadas deste parceiro no período.'
          );
        }

        const lines = items.map((item) => ({ item, ...itemSplit(item) }));
        const totals = settlementTotals(
          lines.map((line) => ({ gross: line.item.totalAmount, commission: line.commission })),
          adjustment
        );

        if (totals.net.lessThan(0)) {
          throw AppError.validation(
            'NEGATIVE_SETTLEMENT',
            'O ajuste deixa o repasse negativo. Revise o valor.'
          );
        }

        const created = await tx.partnerSettlement.create({
          data: {
            partnerId,
            periodStart: civilToDate(input.periodStart),
            periodEnd: civilToDate(input.periodEnd),
            grossSalesAmount: totals.gross,
            commissionAmount: totals.commission,
            adjustmentAmount: adjustment,
            adjustmentReason: input.adjustmentReason ?? null,
            netPayableAmount: totals.net,
            currency: DEFAULT_CURRENCY,
            idempotencyKey: key,
            dueDate: input.dueDate ? civilToDate(input.dueDate) : null,
            notes: input.notes ?? null,
            createdById: actor.userId
          }
        });

        await tx.partnerSettlementItem.createMany({
          data: lines.map((line) => ({
            partnerSettlementId: created.id,
            orderItemId: line.item.id,
            grossAmount: line.item.totalAmount,
            commissionAmount: line.commission,
            netAmount: line.partnerAmount,
            currency: line.item.currency
          }))
        });
        await this.audit.record(
          {
            actorUserId: actor.userId,
            action: 'settlement.created',
            entityType: 'PartnerSettlement',
            entityId: created.id,
            reason: input.adjustmentReason ?? null,
            after: {
              partnerId,
              items: lines.length,
              gross: totals.gross.toFixed(2),
              commission: totals.commission.toFixed(2),
              adjustment: adjustment.toFixed(2),
              net: totals.net.toFixed(2),
              withoutSnapshot: items.filter((item) => item.partnerAmountSnapshot === null).length
            },
            meta
          },
          tx
        );

        return created.id;
      },
      { timeout: 30_000 }
    );

    return this.get(id);
  }

  /** Envio para aprovação, aprovação, retorno a rascunho e cancelamento. */
  async changeStatus(
    actor: Principal,
    id: string,
    status: PartnerSettlementStatus,
    reason: string | undefined,
    meta: RequestMeta
  ): Promise<SettlementView> {
    if (status === 'PAID') {
      throw AppError.validation(
        'USE_PAY_ENDPOINT',
        'Use a ação "Registrar pagamento" para lançar a saída no Caixa.'
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'settlement', id);
      const current = await tx.partnerSettlement.findUnique({ where: { id } });

      if (current === null) {
        throw AppError.notFound('Repasse não encontrado.');
      }

      assertTransition(SETTLEMENT_TRANSITIONS, current.status, status, SETTLEMENT_STATUS_LABELS);

      if (status === 'CANCELLED' && !reason) {
        throw AppError.validation('REASON_REQUIRED', 'Informe o motivo do cancelamento.');
      }

      let releasedItems: string[] = [];

      if (status === 'CANCELLED') {
        // Repasse não pago não tem efeito financeiro: os itens voltam a ficar elegíveis
        // e a lista liberada fica registrada na auditoria (DT-033).
        const items = await tx.partnerSettlementItem.findMany({
          where: { partnerSettlementId: id },
          select: { orderItemId: true }
        });

        releasedItems = items.map((item) => item.orderItemId);
        await tx.partnerSettlementItem.deleteMany({ where: { partnerSettlementId: id } });
      }

      await tx.partnerSettlement.update({
        where: { id },
        data: {
          status,
          ...(status === 'APPROVED' ? { approvedById: actor.userId, approvedAt: new Date() } : {}),
          ...(status === 'CANCELLED'
            ? { cancelledAt: new Date(), cancellationReason: reason ?? null }
            : {})
        }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'settlement.status.changed',
          entityType: 'PartnerSettlement',
          entityId: id,
          reason: reason ?? null,
          before: { status: current.status },
          after: { status, ...(status === 'CANCELLED' ? { releasedItems } : {}) },
          meta
        },
        tx
      );
    });

    return this.get(id);
  }

  /**
   * Pagamento do repasse aprovado: uma única saída no Caixa vinculada ao repasse
   * (origem PARTNER_SETTLEMENT, categoria de repasses). Reenvio devolve o mesmo estado.
   */
  async pay(
    actor: Principal,
    id: string,
    input: { accountId: string; paidOn: string; paymentMethodId?: string; notes?: string },
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<SettlementView> {
    if (!actor.permissions.has(PERMISSIONS.transactionsConfirm)) {
      throw AppError.forbidden('Registrar o pagamento exige permissão de confirmar lançamentos.');
    }

    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'settlement', id);
      const current = await tx.partnerSettlement.findUnique({
        where: { id },
        include: { partner: { select: { displayName: true } } }
      });

      if (current === null) {
        throw AppError.notFound('Repasse não encontrado.');
      }

      if (current.status === 'PAID') {
        return;
      }

      assertTransition(SETTLEMENT_TRANSITIONS, current.status, 'PAID', SETTLEMENT_STATUS_LABELS);

      const occurredAt = startOfDayInZone(input.paidOn);
      let transactionId: string | null = null;

      if (current.netPayableAmount.greaterThan(0)) {
        transactionId = await this.ledger.post(tx, actor.userId, {
          accountId: input.accountId,
          categoryId: await this.ledger.categoryId(tx, SYSTEM_CATEGORY.partnerPayouts),
          paymentMethodId: input.paymentMethodId ?? null,
          direction: 'EXPENSE',
          origin: 'PARTNER_SETTLEMENT',
          amount: current.netPayableAmount,
          occurredAt,
          description: `Repasse ${current.partner.displayName} — ${dateToCivil(current.periodStart)} a ${dateToCivil(current.periodEnd)}`,
          notes: input.notes ?? null,
          // Chave natural: um repasse gera no máximo uma saída, qualquer que seja o reenvio.
          idempotencyKey: `partner-settlement:${id}`,
          status: 'CONFIRMED',
          partnerSettlementId: id
        });
      }

      await tx.partnerSettlement.update({
        where: { id },
        data: { status: 'PAID', paidAt: occurredAt }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'settlement.paid',
          entityType: 'PartnerSettlement',
          entityId: id,
          after: {
            amount: current.netPayableAmount.toFixed(2),
            transactionId,
            accountId: input.accountId,
            requestKey: idempotencyKey
          },
          meta
        },
        tx
      );
    });

    return this.get(id);
  }

  /**
   * RN-PAR-003: vendas pagas por parceiro no período, separando receita do time
   * (comissão) e valor devido, com o que já foi incluído em repasses e pago.
   */
  async salesReport(from: string, to: string, partnerId?: string): Promise<PartnerSalesReport> {
    const items = await this.prisma.orderItem.findMany({
      where: {
        partnerId: partnerId ?? { not: null },
        order: {
          status: { in: PAID_ORDER_STATUSES },
          paidAt: { gte: startOfDayInZone(from), lt: endOfDayExclusive(to) }
        }
      },
      include: {
        ...ITEM_INCLUDE,
        partner: {
          select: {
            id: true,
            displayName: true,
            commissionType: true,
            commissionPercentage: true,
            commissionFixedAmount: true
          }
        },
        settlementItem: {
          select: { netAmount: true, partnerSettlement: { select: { status: true } } }
        }
      }
    });
    const byPartner = new Map<
      string,
      {
        name: string;
        itemCount: number;
        quantity: number;
        gross: Money[];
        team: Money[];
        partner: Money[];
        settled: Money[];
        paid: Money[];
      }
    >();

    for (const item of items) {
      if (item.partner === null) {
        continue;
      }

      const split = itemSplit(item);
      const entry = byPartner.get(item.partner.id) ?? {
        name: item.partner.displayName,
        itemCount: 0,
        quantity: 0,
        gross: [],
        team: [],
        partner: [],
        settled: [],
        paid: []
      };

      entry.itemCount += 1;
      entry.quantity += item.quantity;
      entry.gross.push(item.totalAmount);
      entry.team.push(split.commission);
      entry.partner.push(split.partnerAmount);

      if (item.settlementItem) {
        entry.settled.push(item.settlementItem.netAmount);

        if (item.settlementItem.partnerSettlement.status === 'PAID') {
          entry.paid.push(item.settlementItem.netAmount);
        }
      }

      byPartner.set(item.partner.id, entry);
    }

    const lines = [...byPartner.entries()]
      .map(([id, entry]) => {
        const partnerAmount = sum(entry.partner);
        const paid = sum(entry.paid);

        return {
          partner: { id, name: entry.name },
          itemCount: entry.itemCount,
          quantity: entry.quantity,
          gross: moneyView(sum(entry.gross)),
          teamRevenue: moneyView(sum(entry.team)),
          partnerAmount: moneyView(partnerAmount),
          settledAmount: moneyView(sum(entry.settled)),
          paidOutAmount: moneyView(paid),
          pendingAmount: moneyView(partnerAmount.minus(paid))
        };
      })
      .sort((a, b) => a.partner.name.localeCompare(b.partner.name, 'pt-BR'));

    return {
      from,
      to,
      timeZone: 'America/Rio_Branco',
      lines,
      totals: {
        gross: moneyView(sum(lines.map((l) => money(l.gross.amount)))),
        teamRevenue: moneyView(sum(lines.map((l) => money(l.teamRevenue.amount)))),
        partnerAmount: moneyView(sum(lines.map((l) => money(l.partnerAmount.amount))))
      }
    };
  }
}
