import { Injectable } from '@nestjs/common';
import type { AthleteStatus, FinancialOrigin, TryoutRegistrationStatus } from '@prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { civilToDate, dateToCivil, monthStart, todayIn } from '../../../common/domain/civil-date';
import { DEFAULT_CURRENCY, type Money, money, sum, ZERO } from '../../../common/domain/money';
import {
  endOfDayExclusive,
  startOfDayInZone,
  TEAM_TIME_ZONE
} from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CSV_BOM, toCsv } from '../../../common/util/csv';
import { CAMPAIGN_STATUS_LABELS } from '../../campaigns/domain/campaign-rules';
import {
  PAID_ORDER_STATUSES,
  SettlementsService
} from '../../partners/application/settlements.service';
import {
  type CashGrouping,
  columnTotals,
  periodLabel,
  type ReportCell,
  type ReportColumn,
  reportDefinition,
  type ReportKey,
  type ReportTable
} from '../domain/report-catalog';

export interface ReportQuery {
  readonly from?: string;
  readonly to?: string;
  readonly groupBy?: CashGrouping;
}

const ATHLETE_STATUS: Record<AthleteStatus, string> = {
  PENDING: 'Pendente',
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  SUSPENDED: 'Suspenso'
};

const ORIGIN_LABELS: Record<FinancialOrigin, string> = {
  MANUAL: 'Lançamento manual',
  MONTHLY_FEE: 'Mensalidades',
  ORDER: 'Pedidos da loja',
  REFUND: 'Estornos e reembolsos',
  PARTNER_SETTLEMENT: 'Repasses a parceiros',
  TRANSFER: 'Transferências',
  OPENING_BALANCE: 'Saldo inicial',
  ADJUSTMENT: 'Ajustes'
};

const TRYOUT_COLUMNS: { status: TryoutRegistrationStatus; key: string; label: string }[] = [
  { status: 'NEW', key: 'new', label: 'Novas' },
  { status: 'UNDER_REVIEW', key: 'review', label: 'Em análise' },
  { status: 'APPROVED', key: 'approved', label: 'Aprovadas' },
  { status: 'REJECTED', key: 'rejected', label: 'Recusadas' },
  { status: 'ATTENDED', key: 'attended', label: 'Compareceram' },
  { status: 'NO_SHOW', key: 'noShow', label: 'Faltaram' },
  { status: 'CANCELLED', key: 'cancelled', label: 'Canceladas' }
];

function addMoney(a: string, b: string): string {
  return money(a).plus(b).toFixed(2);
}

function fixed(value: Money): string {
  return value.toFixed(2);
}

/**
 * Relatórios integrados (RF-021, RF-045). Cada relatório informa período, fuso, moeda e
 * instante de geração, minimiza dados pessoais e deriva totais das fontes (Decimal).
 * Exportação CSV exige permissão própria e é auditada (DT-035).
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settlements: SettlementsService
  ) {}

  private table(
    key: ReportKey,
    period: { from: string; to: string } | null,
    columns: ReportColumn[],
    rows: Record<string, ReportCell>[]
  ): ReportTable {
    const definition = reportDefinition(key);

    return {
      key,
      title: definition?.title ?? key,
      period,
      timeZone: TEAM_TIME_ZONE,
      currency: DEFAULT_CURRENCY,
      generatedAt: new Date().toISOString(),
      columns,
      rows,
      totals: rows.length > 0 ? columnTotals(columns, rows, addMoney) : null
    };
  }

  private period(query: ReportQuery): { from: string; to: string } {
    if (!query.from || !query.to) {
      throw AppError.validation('PERIOD_REQUIRED', 'Informe o período (de e até).');
    }

    if (query.to < query.from) {
      throw AppError.validation('INVALID_PERIOD', 'O fim do período deve ser após o início.');
    }

    const days = (civilToDate(query.to).getTime() - civilToDate(query.from).getTime()) / 86_400_000;

    // Limite defensivo para consultas síncronas (PEN-049).
    if (days > 731) {
      throw AppError.validation('PERIOD_TOO_LONG', 'Use períodos de até 2 anos.');
    }

    return { from: query.from, to: query.to };
  }

  async run(key: string, query: ReportQuery): Promise<ReportTable> {
    const definition = reportDefinition(key);

    if (definition === undefined) {
      throw AppError.notFound('Relatório não encontrado.');
    }

    switch (definition.key) {
      case 'athletes':
        return this.athletes();
      case 'tryouts':
        return this.tryouts(this.period(query));
      case 'fees':
        return this.fees(this.period(query));
      case 'cash':
        return this.cash(this.period(query), query.groupBy ?? 'category');
      case 'pending-proofs':
        return this.pendingProofs();
      case 'sales-products':
        return this.salesProducts(this.period(query));
      case 'sales-partners':
        return this.salesPartners(this.period(query));
      case 'campaigns':
        return this.campaigns();
    }
  }

  /** Exportação: cabeçalho com relatório, período, fuso e geração; cada exportação é auditada. */
  async exportCsv(
    actor: Principal,
    key: string,
    query: ReportQuery,
    meta: RequestMeta
  ): Promise<{ fileName: string; content: string }> {
    const report = await this.run(key, query);
    const header = [
      `# ${report.title}`,
      `# Período: ${periodLabel(report.period, report.timeZone)}`,
      `# Moeda: ${report.currency} · Gerado em: ${report.generatedAt} (UTC)`
    ];
    const body = toCsv(
      report.columns.map((column) => column.label),
      [
        ...report.rows.map((row) => report.columns.map((column) => row[column.key] ?? null)),
        ...(report.totals
          ? [
              report.columns.map((column, index) =>
                index === 0 ? 'Total' : (report.totals?.[column.key] ?? null)
              )
            ]
          : [])
      ]
    );

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'report.exported',
      entityType: 'Report',
      after: {
        report: report.key,
        from: report.period?.from ?? null,
        to: report.period?.to ?? null,
        groupBy: query.groupBy ?? null,
        rows: report.rows.length
      },
      meta
    });

    const suffix = report.period ? `${report.period.from}_${report.period.to}` : todayIn();

    return {
      fileName: `fenix-${report.key}-${suffix}.csv`,
      content: CSV_BOM + [...header, body].join('\n')
    };
  }

  private async athletes(): Promise<ReportTable> {
    const athletes = await this.prisma.athlete.findMany({
      where: { deletedAt: null },
      select: {
        status: true,
        teamMemberships: {
          where: { status: 'ACTIVE', endsOn: null },
          select: { team: { select: { name: true } } }
        }
      }
    });
    const counts = new Map<string, number>();

    for (const athlete of athletes) {
      const teams = athlete.teamMemberships.map((m) => m.team.name);

      for (const team of teams.length > 0 ? teams : ['Sem equipe']) {
        const key = `${team}\u0000${athlete.status}`;

        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const rows = [...counts.entries()]
      .map(([key, count]) => {
        const [team, status] = key.split('\u0000') as [string, AthleteStatus];

        return { team, status: ATHLETE_STATUS[status], count };
      })
      .sort((a, b) => a.team.localeCompare(b.team, 'pt-BR') || a.status.localeCompare(b.status));

    return this.table(
      'athletes',
      null,
      [
        { key: 'team', label: 'Equipe', kind: 'text' },
        { key: 'status', label: 'Situação', kind: 'text' },
        { key: 'count', label: 'Atletas', kind: 'number' }
      ],
      rows
    );
  }

  private async tryouts(period: { from: string; to: string }): Promise<ReportTable> {
    const grouped = await this.prisma.tryoutRegistration.groupBy({
      by: ['tryoutId', 'status'],
      where: {
        createdAt: { gte: startOfDayInZone(period.from), lt: endOfDayExclusive(period.to) }
      },
      _count: true
    });
    const tryouts = await this.prisma.tryout.findMany({
      where: { id: { in: [...new Set(grouped.map((g) => g.tryoutId))] } },
      select: { id: true, title: true, startsAt: true }
    });
    const rows = tryouts
      .map((tryout) => {
        const row: Record<string, ReportCell> = {
          tryout: tryout.title,
          startsAt: tryout.startsAt?.toISOString() ?? null
        };
        let total = 0;

        for (const column of TRYOUT_COLUMNS) {
          const count =
            grouped.find((g) => g.tryoutId === tryout.id && g.status === column.status)?._count ??
            0;

          row[column.key] = count;
          total += count;
        }

        row['total'] = total;

        return row;
      })
      .sort((a, b) => String(a['tryout']).localeCompare(String(b['tryout']), 'pt-BR'));

    return this.table(
      'tryouts',
      period,
      [
        { key: 'tryout', label: 'Seletiva', kind: 'text' },
        { key: 'startsAt', label: 'Data', kind: 'datetime' },
        { key: 'total', label: 'Inscrições', kind: 'number' },
        ...TRYOUT_COLUMNS.map((c) => ({ key: c.key, label: c.label, kind: 'number' as const }))
      ],
      rows
    );
  }

  private async fees(period: { from: string; to: string }): Promise<ReportTable> {
    const today = civilToDate(todayIn());
    const fees = await this.prisma.monthlyFee.findMany({
      where: {
        status: { not: 'CANCELLED' },
        referenceMonth: {
          gte: civilToDate(monthStart(period.from)),
          lte: civilToDate(period.to)
        }
      },
      select: {
        referenceMonth: true,
        dueDate: true,
        totalAmount: true,
        paymentAllocations: {
          select: { allocatedAmount: true, payment: { select: { status: true } } }
        }
      }
    });
    const byMonth = new Map<
      string,
      {
        count: number;
        total: Money[];
        paid: Money[];
        open: Money[];
        overdueCount: number;
        overdue: Money[];
      }
    >();

    for (const fee of fees) {
      const month = dateToCivil(fee.referenceMonth).slice(0, 7);
      const entry = byMonth.get(month) ?? {
        count: 0,
        total: [],
        paid: [],
        open: [],
        overdueCount: 0,
        overdue: []
      };
      const paid = sum(
        fee.paymentAllocations
          .filter((a) => a.payment.status === 'CONFIRMED')
          .map((a) => a.allocatedAmount)
      );
      const remaining = fee.totalAmount.minus(paid);
      const open = remaining.greaterThan(0) ? remaining : ZERO;

      entry.count += 1;
      entry.total.push(fee.totalAmount);
      entry.paid.push(paid);
      entry.open.push(open);

      if (open.greaterThan(0) && fee.dueDate < today) {
        entry.overdueCount += 1;
        entry.overdue.push(open);
      }

      byMonth.set(month, entry);
    }

    const rows = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, entry]) => ({
        month: `${month.slice(5, 7)}/${month.slice(0, 4)}`,
        count: entry.count,
        total: fixed(sum(entry.total)),
        paid: fixed(sum(entry.paid)),
        open: fixed(sum(entry.open)),
        overdueCount: entry.overdueCount,
        overdue: fixed(sum(entry.overdue))
      }));

    return this.table(
      'fees',
      period,
      [
        { key: 'month', label: 'Mês de referência', kind: 'text' },
        { key: 'count', label: 'Cobranças', kind: 'number' },
        { key: 'total', label: 'Emitido', kind: 'money' },
        { key: 'paid', label: 'Pago', kind: 'money' },
        { key: 'open', label: 'Em aberto', kind: 'money' },
        { key: 'overdueCount', label: 'Vencidas', kind: 'number' },
        { key: 'overdue', label: 'Valor vencido', kind: 'money' }
      ],
      rows
    );
  }

  private async cash(
    period: { from: string; to: string },
    groupBy: CashGrouping
  ): Promise<ReportTable> {
    const field = (
      {
        category: 'categoryId',
        account: 'accountId',
        costCenter: 'costCenterId',
        origin: 'origin'
      } as const
    )[groupBy];
    const grouped = await this.prisma.financialTransaction.groupBy({
      by: [field, 'direction'],
      where: {
        status: 'CONFIRMED',
        origin: { not: 'TRANSFER' },
        occurredAt: { gte: startOfDayInZone(period.from), lt: endOfDayExclusive(period.to) }
      },
      _sum: { amount: true },
      _count: true
    });
    const ids = [...new Set(grouped.map((g) => g[field]).filter((v): v is string => Boolean(v)))];
    const names = new Map<string, string>(
      groupBy === 'category'
        ? (await this.prisma.financialCategory.findMany({ where: { id: { in: ids } } })).map(
            (r) => [r.id, r.name]
          )
        : groupBy === 'account'
          ? (await this.prisma.financialAccount.findMany({ where: { id: { in: ids } } })).map(
              (r) => [r.id, r.name]
            )
          : groupBy === 'costCenter'
            ? (await this.prisma.costCenter.findMany({ where: { id: { in: ids } } })).map((r) => [
                r.id,
                r.name
              ])
            : Object.entries(ORIGIN_LABELS)
    );
    const byGroup = new Map<string, { income: Money; expense: Money; count: number }>();

    for (const row of grouped) {
      const raw = row[field];
      const label = raw ? (names.get(raw) ?? raw) : 'Sem centro de custo';
      const entry = byGroup.get(label) ?? { income: ZERO, expense: ZERO, count: 0 };
      const amount = row._sum.amount ?? ZERO;

      if (row.direction === 'INCOME') {
        entry.income = entry.income.plus(amount);
      } else {
        entry.expense = entry.expense.plus(amount);
      }

      entry.count += row._count;
      byGroup.set(label, entry);
    }

    const rows = [...byGroup.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([group, entry]) => ({
        group,
        income: fixed(entry.income),
        expense: fixed(entry.expense),
        result: fixed(entry.income.minus(entry.expense)),
        count: entry.count
      }));
    const groupLabel = reportDefinition('cash')?.groupings?.find((g) => g.value === groupBy)?.label;

    return this.table(
      'cash',
      period,
      [
        { key: 'group', label: groupLabel ?? 'Agrupamento', kind: 'text' },
        { key: 'income', label: 'Entradas', kind: 'money' },
        { key: 'expense', label: 'Saídas', kind: 'money' },
        { key: 'result', label: 'Resultado', kind: 'money' },
        { key: 'count', label: 'Lançamentos', kind: 'number' }
      ],
      rows
    );
  }

  private async pendingProofs(): Promise<ReportTable> {
    const [payments, expenses] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: 'PENDING' },
        select: {
          amount: true,
          createdAt: true,
          order: { select: { orderNumber: true } },
          monthlyFeeAllocations: {
            select: { monthlyFee: { select: { referenceMonth: true } } },
            take: 1
          }
        },
        orderBy: { createdAt: 'asc' },
        take: 500
      }),
      this.prisma.financialTransaction.findMany({
        where: {
          status: 'CONFIRMED',
          direction: 'EXPENSE',
          paymentId: null,
          origin: { notIn: ['TRANSFER', 'REFUND'] },
          attachments: { none: { deletedAt: null } }
        },
        select: { amount: true, occurredAt: true, description: true },
        orderBy: { occurredAt: 'asc' },
        take: 500
      })
    ]);
    const rows: Record<string, ReportCell>[] = [
      ...payments.map((p) => {
        const fee = p.monthlyFeeAllocations[0]?.monthlyFee;

        return {
          kind: 'Pagamento aguardando confirmação',
          reference: p.order
            ? `Pedido ${p.order.orderNumber}`
            : fee
              ? `Mensalidade ${dateToCivil(fee.referenceMonth).slice(5, 7)}/${dateToCivil(fee.referenceMonth).slice(0, 4)}`
              : 'Pagamento',
          amount: fixed(p.amount),
          since: p.createdAt.toISOString()
        };
      }),
      ...expenses.map((e) => ({
        kind: 'Despesa sem comprovante',
        reference: e.description,
        amount: fixed(e.amount),
        since: e.occurredAt?.toISOString() ?? null
      }))
    ];

    return this.table(
      'pending-proofs',
      null,
      [
        { key: 'kind', label: 'Pendência', kind: 'text' },
        { key: 'reference', label: 'Referência', kind: 'text' },
        { key: 'amount', label: 'Valor', kind: 'money' },
        { key: 'since', label: 'Desde', kind: 'datetime' }
      ],
      rows
    );
  }

  private async salesProducts(period: { from: string; to: string }): Promise<ReportTable> {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: PAID_ORDER_STATUSES },
          paidAt: { gte: startOfDayInZone(period.from), lt: endOfDayExclusive(period.to) }
        }
      },
      select: {
        productName: true,
        quantity: true,
        totalAmount: true,
        selectedAttributes: true,
        partner: { select: { displayName: true } }
      }
    });
    const byKey = new Map<
      string,
      { product: string; variant: string; origin: string; quantity: number; gross: Money }
    >();

    for (const item of items) {
      const variant = String(
        (item.selectedAttributes as { variant?: unknown } | null)?.variant ?? ''
      );
      const origin = item.partner?.displayName ?? 'Fênix';
      const key = `${item.productName}\u0000${variant}\u0000${origin}`;
      const entry = byKey.get(key) ?? {
        product: item.productName,
        variant,
        origin,
        quantity: 0,
        gross: ZERO
      };

      entry.quantity += item.quantity;
      entry.gross = entry.gross.plus(item.totalAmount);
      byKey.set(key, entry);
    }

    const rows = [...byKey.values()]
      .sort((a, b) => b.gross.comparedTo(a.gross) || a.product.localeCompare(b.product, 'pt-BR'))
      .map((entry) => ({
        product: entry.product,
        variant: entry.variant,
        origin: entry.origin,
        quantity: entry.quantity,
        gross: fixed(entry.gross)
      }));

    return this.table(
      'sales-products',
      period,
      [
        { key: 'product', label: 'Produto', kind: 'text' },
        { key: 'variant', label: 'Variação', kind: 'text' },
        { key: 'origin', label: 'Origem', kind: 'text' },
        { key: 'quantity', label: 'Unidades', kind: 'number' },
        { key: 'gross', label: 'Vendido', kind: 'money' }
      ],
      rows
    );
  }

  private async salesPartners(period: { from: string; to: string }): Promise<ReportTable> {
    const report = await this.settlements.salesReport(period.from, period.to);

    return this.table(
      'sales-partners',
      period,
      [
        { key: 'partner', label: 'Parceiro', kind: 'text' },
        { key: 'quantity', label: 'Unidades', kind: 'number' },
        { key: 'gross', label: 'Vendido', kind: 'money' },
        { key: 'teamRevenue', label: 'Receita do time', kind: 'money' },
        { key: 'partnerAmount', label: 'Devido ao parceiro', kind: 'money' },
        { key: 'paidOut', label: 'Já repassado', kind: 'money' },
        { key: 'pending', label: 'A repassar', kind: 'money' }
      ],
      report.lines.map((line) => ({
        partner: line.partner.name,
        quantity: line.quantity,
        gross: line.gross.amount,
        teamRevenue: line.teamRevenue.amount,
        partnerAmount: line.partnerAmount.amount,
        paidOut: line.paidOutAmount.amount,
        pending: line.pendingAmount.amount
      }))
    );
  }

  private async campaigns(): Promise<ReportTable> {
    const campaigns = await this.prisma.salesCampaign.findMany({
      where: { deletedAt: null },
      select: {
        name: true,
        status: true,
        salesEndAt: true,
        minimumQuantity: true,
        products: {
          select: {
            orderItems: {
              where: { order: { status: { in: PAID_ORDER_STATUSES } } },
              select: { quantity: true, totalAmount: true, orderId: true }
            }
          }
        }
      },
      orderBy: { salesStartAt: 'desc' },
      take: 200
    });
    const rows = campaigns.map((campaign) => {
      const items = campaign.products.flatMap((p) => p.orderItems);

      return {
        campaign: campaign.name,
        status: CAMPAIGN_STATUS_LABELS[campaign.status],
        salesEndAt: campaign.salesEndAt.toISOString(),
        minimum: campaign.minimumQuantity,
        units: items.reduce((total, item) => total + item.quantity, 0),
        orders: new Set(items.map((item) => item.orderId)).size,
        amount: fixed(sum(items.map((item) => item.totalAmount)))
      };
    });

    return this.table(
      'campaigns',
      null,
      [
        { key: 'campaign', label: 'Remessa', kind: 'text' },
        { key: 'status', label: 'Situação', kind: 'text' },
        { key: 'salesEndAt', label: 'Vendas até', kind: 'datetime' },
        { key: 'minimum', label: 'Mínimo', kind: 'text' },
        { key: 'units', label: 'Unidades pagas', kind: 'number' },
        { key: 'orders', label: 'Pedidos pagos', kind: 'number' },
        { key: 'amount', label: 'Valor pago', kind: 'money' }
      ],
      rows
    );
  }
}
