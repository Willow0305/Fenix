import { Injectable } from '@nestjs/common';
import type { MonthlyFeePlanStatus, MonthlyFeeStatus, Prisma } from '@prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import {
  addDays,
  civilToDate,
  dateToCivil,
  daysInMonth,
  optionalCivil,
  todayIn
} from '../../../common/domain/civil-date';
import {
  DEFAULT_CURRENCY,
  type Money,
  money,
  type MoneyView,
  moneyView,
  round2,
  sum,
  ZERO
} from '../../../common/domain/money';
import { startOfDayInZone } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import {
  DOCUMENT_POLICY,
  type IncomingFile,
  MediaService
} from '../../media/application/media.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { SYSTEM_CATEGORY } from '../domain/finance-catalog';
import {
  dueDateFor,
  effectiveFeeStatus,
  feeStatusAfterPayments,
  feeTotal,
  planCoversMonth,
  remainingAmount
} from '../domain/finance-rules';
import { lockRow } from './ledger.service';
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

type PlanRow = NonNullable<Awaited<ReturnType<PrismaTx['monthlyFeePlan']['findFirst']>>>;

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

const FEE_INCLUDE = {
  athlete: { select: { id: true, fullName: true, userId: true } },
  monthlyFeePlan: { select: { id: true, name: true } },
  paymentAllocations: {
    select: { allocatedAmount: true, payment: { select: { id: true, status: true } } }
  }
} satisfies Prisma.MonthlyFeeInclude;

type FeeRow = Prisma.MonthlyFeeGetPayload<{ include: typeof FEE_INCLUDE }>;

function paidOf(row: FeeRow): { confirmed: Money; pending: Money } {
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

function monthOf(referenceMonth: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth)) {
    throw AppError.validation('INVALID_MONTH', 'Mês de referência inválido (AAAA-MM).');
  }

  return `${referenceMonth}-01`;
}

/** Mensalidades (RF-011 a RF-014, DT-027). */
@Injectable()
export class FeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService
  ) {}

  // ---------- Planos ----------

  async plans(): Promise<PlanView[]> {
    const rows = await this.prisma.monthlyFeePlan.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { athletePlans: { where: { status: 'ACTIVE' } } } } }
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      amount: moneyView(row.amount, row.currency),
      dueDay: row.dueDay,
      status: row.status,
      activeAthletes: row._count.athletePlans
    }));
  }

  async createPlan(
    actor: Principal,
    input: { name: string; description?: string; amount: Money; dueDay: number },
    meta: RequestMeta
  ): Promise<PlanView> {
    const row = await this.prisma.monthlyFeePlan.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        amount: input.amount,
        currency: DEFAULT_CURRENCY,
        dueDay: input.dueDay
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'fee_plan.created',
      entityType: 'MonthlyFeePlan',
      entityId: row.id,
      after: { name: row.name, amount: input.amount.toFixed(2), dueDay: row.dueDay },
      meta
    });

    return (await this.plans()).find((p) => p.id === row.id) as PlanView;
  }

  /** RN-MEN-001: alterar ou inativar plano não altera cobranças já geradas. */
  async updatePlan(
    actor: Principal,
    id: string,
    input: {
      name?: string;
      description?: string;
      amount?: Money;
      dueDay?: number;
      status?: MonthlyFeePlanStatus;
    },
    meta: RequestMeta
  ): Promise<PlanView> {
    const before = await this.prisma.monthlyFeePlan.findFirst({ where: { id, deletedAt: null } });

    if (before === null) {
      throw AppError.notFound('Plano não encontrado.');
    }

    await this.prisma.monthlyFeePlan.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.description === undefined ? {} : { description: input.description || null }),
        ...(input.amount === undefined ? {} : { amount: input.amount }),
        ...(input.dueDay === undefined ? {} : { dueDay: input.dueDay }),
        ...(input.status === undefined ? {} : { status: input.status })
      }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'fee_plan.updated',
      entityType: 'MonthlyFeePlan',
      entityId: id,
      before: {
        name: before.name,
        amount: before.amount.toFixed(2),
        dueDay: before.dueDay,
        status: before.status
      },
      after: { ...input, ...(input.amount ? { amount: input.amount.toFixed(2) } : {}) },
      meta
    });

    return (await this.plans()).find((p) => p.id === id) as PlanView;
  }

  // ---------- Vínculo atleta–plano ----------

  async athletePlans(athleteId: string): Promise<AthletePlanView[]> {
    const rows = await this.prisma.athleteMonthlyFeePlan.findMany({
      where: { athleteId },
      orderBy: { startsOn: 'desc' },
      include: { monthlyFeePlan: true }
    });

    return rows.map((row) => ({
      id: row.id,
      plan: { id: row.monthlyFeePlan.id, name: row.monthlyFeePlan.name },
      startsOn: dateToCivil(row.startsOn),
      endsOn: optionalCivil(row.endsOn),
      amountOverride: row.amountOverride ? moneyView(row.amountOverride) : null,
      effectiveAmount: moneyView(row.amountOverride ?? row.monthlyFeePlan.amount),
      status: row.status
    }));
  }

  /**
   * Núcleo da atribuição, dentro de uma transação. Com `replaceCurrent`, o plano vigente
   * de outro tipo termina na véspera do novo início (troca de plano sem buraco nem
   * sobreposição). Bolsa/desconto individual fica como valor próprio no vínculo (auditado).
   */
  private async assignInTx(
    tx: PrismaTx,
    actor: Principal,
    athleteId: string,
    plan: PlanRow,
    input: { startsOn: string; amountOverride?: Money; reason?: string; replaceCurrent?: boolean },
    meta: RequestMeta
  ): Promise<'assigned' | 'same-plan' | 'other-plan'> {
    const active = await tx.athleteMonthlyFeePlan.findFirst({
      where: { athleteId, status: 'ACTIVE', endsOn: null },
      include: { monthlyFeePlan: { select: { name: true } } }
    });

    if (active && active.monthlyFeePlanId === plan.id) {
      return 'same-plan';
    }

    if (active && !input.replaceCurrent) {
      return 'other-plan';
    }

    if (active) {
      const endsOn = addDays(input.startsOn, -1);

      if (endsOn < dateToCivil(active.startsOn)) {
        throw AppError.validation(
          'INVALID_START_DATE',
          'A troca precisa começar depois do início do plano atual do atleta.'
        );
      }

      await tx.athleteMonthlyFeePlan.update({
        where: { id: active.id },
        data: { endsOn: civilToDate(endsOn), status: 'ENDED' }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'athlete_plan.ended',
          entityType: 'Athlete',
          entityId: athleteId,
          reason: input.reason ?? `Troca para o plano ${plan.name}`,
          after: { athletePlanId: active.id, endsOn, replacedBy: plan.name },
          meta
        },
        tx
      );
    }

    const created = await tx.athleteMonthlyFeePlan.create({
      data: {
        athleteId,
        monthlyFeePlanId: plan.id,
        startsOn: civilToDate(input.startsOn),
        amountOverride: input.amountOverride ?? null,
        currency: input.amountOverride ? DEFAULT_CURRENCY : null
      }
    });

    await this.audit.record(
      {
        actorUserId: actor.userId,
        action: 'athlete_plan.assigned',
        entityType: 'Athlete',
        entityId: athleteId,
        reason: input.reason ?? null,
        after: {
          athletePlanId: created.id,
          plan: plan.name,
          startsOn: input.startsOn,
          amountOverride: input.amountOverride?.toFixed(2) ?? null
        },
        meta
      },
      tx
    );

    return 'assigned';
  }

  private async activePlanOrFail(tx: PrismaTx, planId: string): Promise<PlanRow> {
    const plan = await tx.monthlyFeePlan.findFirst({
      where: { id: planId, deletedAt: null, status: 'ACTIVE' }
    });

    if (plan === null) {
      throw AppError.validation('INVALID_PLAN', 'Plano inexistente ou inativo.');
    }

    return plan;
  }

  async assignPlan(
    actor: Principal,
    athleteId: string,
    input: { planId: string; startsOn: string; amountOverride?: Money; reason?: string },
    meta: RequestMeta
  ): Promise<AthletePlanView[]> {
    await this.prisma.$transaction(async (tx) => {
      const athlete = await tx.athlete.findFirst({
        where: { id: athleteId, deletedAt: null },
        select: { id: true }
      });

      if (athlete === null) {
        throw AppError.notFound('Atleta não encontrado.');
      }

      const plan = await this.activePlanOrFail(tx, input.planId);
      const result = await this.assignInTx(tx, actor, athleteId, plan, input, meta);

      if (result !== 'assigned') {
        throw AppError.conflict(
          'PLAN_ACTIVE',
          'O atleta já possui plano vigente. Encerre-o antes de atribuir outro.'
        );
      }
    });

    return this.athletePlans(athleteId);
  }

  /** Atletas do plano: vigentes primeiro, depois o histórico (COR-021). */
  async planMembers(planId: string): Promise<PlanMemberView[]> {
    const plan = await this.prisma.monthlyFeePlan.findFirst({
      where: { id: planId, deletedAt: null },
      select: { id: true }
    });

    if (plan === null) {
      throw AppError.notFound('Plano não encontrado.');
    }

    const rows = await this.prisma.athleteMonthlyFeePlan.findMany({
      where: { monthlyFeePlanId: planId, athlete: { deletedAt: null } },
      orderBy: [{ endsOn: { sort: 'desc', nulls: 'first' } }, { startsOn: 'desc' }],
      include: {
        monthlyFeePlan: { select: { amount: true, currency: true } },
        athlete: { select: { id: true, fullName: true, status: true } }
      },
      take: 500
    });

    return rows.map((row) => ({
      id: row.id,
      athlete: row.athlete,
      startsOn: dateToCivil(row.startsOn),
      endsOn: optionalCivil(row.endsOn),
      amountOverride: row.amountOverride ? moneyView(row.amountOverride) : null,
      effectiveAmount: moneyView(
        row.amountOverride ?? row.monthlyFeePlan.amount,
        row.monthlyFeePlan.currency
      ),
      status: row.status
    }));
  }

  /** Coloca vários atletas no plano de uma vez; cada um vira uma atribuição auditada. */
  async assignMany(
    actor: Principal,
    planId: string,
    input: {
      athleteIds: string[];
      startsOn: string;
      amountOverride?: Money;
      reason?: string;
      replaceCurrent?: boolean;
    },
    meta: RequestMeta
  ): Promise<BulkAssignResult> {
    return this.prisma.$transaction(async (tx) => {
      const plan = await this.activePlanOrFail(tx, planId);
      const athletes = await tx.athlete.findMany({
        where: { id: { in: [...new Set(input.athleteIds)] }, deletedAt: null },
        select: { id: true, fullName: true }
      });
      const skipped: BulkAssignResult['skipped'] = [];
      let assigned = 0;

      if (athletes.length === 0) {
        throw AppError.validation('NO_ATHLETES', 'Selecione ao menos um atleta.');
      }

      for (const athlete of athletes) {
        const result = await this.assignInTx(tx, actor, athlete.id, plan, input, meta);

        if (result === 'assigned') {
          assigned += 1;
        } else {
          skipped.push({
            athleteId: athlete.id,
            fullName: athlete.fullName,
            reason: result === 'same-plan' ? 'Já está neste plano.' : 'Já tem outro plano vigente.'
          });
        }
      }

      return { assigned, skipped };
    });
  }

  /**
   * Exclusão lógica do plano (fica no histórico das cobranças já geradas). Só sem atletas
   * vigentes: com atletas, encerre os vínculos ou inative o plano.
   */
  async deletePlan(actor: Principal, id: string, reason: string, meta: RequestMeta): Promise<void> {
    const plan = await this.prisma.monthlyFeePlan.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { athletePlans: { where: { status: 'ACTIVE' } } } } }
    });

    if (plan === null) {
      throw AppError.notFound('Plano não encontrado.');
    }

    if (plan._count.athletePlans > 0) {
      throw AppError.conflict(
        'PLAN_IN_USE',
        `O plano tem ${plan._count.athletePlans} atleta(s) vigente(s). Encerre os vínculos ou inative o plano.`
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.monthlyFeePlan.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'INACTIVE' }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'fee_plan.deleted',
          entityType: 'MonthlyFeePlan',
          entityId: id,
          reason,
          before: { name: plan.name, status: plan.status },
          meta
        },
        tx
      );
    });
  }

  async endPlan(
    actor: Principal,
    athleteId: string,
    athletePlanId: string,
    endsOn: string,
    reason: string,
    meta: RequestMeta
  ): Promise<AthletePlanView[]> {
    const current = await this.prisma.athleteMonthlyFeePlan.findFirst({
      where: { id: athletePlanId, athleteId }
    });

    if (current === null) {
      throw AppError.notFound('Vínculo de plano não encontrado.');
    }

    if (current.endsOn !== null || current.status !== 'ACTIVE') {
      throw AppError.conflict('PLAN_ENDED', 'Este vínculo já foi encerrado.');
    }

    if (endsOn < dateToCivil(current.startsOn)) {
      throw AppError.validation('INVALID_END_DATE', 'O término não pode ser anterior ao início.');
    }

    await this.prisma.athleteMonthlyFeePlan.update({
      where: { id: athletePlanId },
      data: { endsOn: civilToDate(endsOn), status: 'ENDED' }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'athlete_plan.ended',
      entityType: 'Athlete',
      entityId: athleteId,
      reason,
      after: { athletePlanId, endsOn },
      meta
    });

    return this.athletePlans(athleteId);
  }

  // ---------- Cobranças ----------

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

  /**
   * RF-012: gera cobranças para atletas ativos com plano vigente no mês. A chave
   * única atleta+mês garante que repetir a geração não duplica (RN-MEN-003).
   */
  async generate(
    actor: Principal,
    referenceMonth: string,
    meta: RequestMeta
  ): Promise<{ created: number; skipped: number }> {
    const month = monthOf(referenceMonth);
    const monthEnd = `${referenceMonth}-${String(daysInMonth(month)).padStart(2, '0')}`;
    const assignments = await this.prisma.athleteMonthlyFeePlan.findMany({
      where: {
        status: { in: ['ACTIVE', 'ENDED'] },
        startsOn: { lte: civilToDate(monthEnd) },
        OR: [{ endsOn: null }, { endsOn: { gte: civilToDate(month) } }],
        athlete: { status: 'ACTIVE', deletedAt: null },
        monthlyFeePlan: { status: 'ACTIVE', deletedAt: null }
      },
      include: { monthlyFeePlan: true, athlete: { select: { id: true, userId: true } } }
    });
    let created = 0;
    let skipped = 0;

    for (const assignment of assignments) {
      if (
        !planCoversMonth(
          { startsOn: dateToCivil(assignment.startsOn), endsOn: optionalCivil(assignment.endsOn) },
          month
        )
      ) {
        continue;
      }

      const amount = round2(assignment.amountOverride ?? assignment.monthlyFeePlan.amount);
      const result = await this.prisma.monthlyFee.createMany({
        data: [
          {
            athleteId: assignment.athleteId,
            monthlyFeePlanId: assignment.monthlyFeePlanId,
            athleteMonthlyFeePlanId: assignment.id,
            referenceMonth: civilToDate(month),
            dueDate: civilToDate(dueDateFor(month, assignment.monthlyFeePlan.dueDay)),
            originalAmount: amount,
            totalAmount: amount,
            currency: assignment.monthlyFeePlan.currency,
            createdById: actor.userId,
            status: amount.greaterThan(0) ? 'OPEN' : 'PAID'
          }
        ],
        skipDuplicates: true
      });

      if (result.count === 1) {
        created += 1;

        if (assignment.athlete.userId) {
          await this.notifications.notify({
            userId: assignment.athlete.userId,
            type: 'fee.created',
            title: 'Nova mensalidade disponível',
            message: `Mensalidade de ${referenceMonth.slice(5, 7)}/${referenceMonth.slice(0, 4)} no valor de R$ ${amount.toFixed(2).replace('.', ',')}.`,
            link: '/minha-conta/mensalidades',
            deduplicationKey: `fee-created:${assignment.athleteId}:${referenceMonth}`
          });
        }
      } else {
        skipped += 1;
      }
    }

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'fees.generated',
      entityType: 'MonthlyFee',
      after: { referenceMonth, created, skipped },
      meta
    });

    return { created, skipped };
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

  private async loadRow(tx: PrismaTx, id: string): Promise<FeeRow> {
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

    const payments = await Promise.all(
      row.paymentAllocations.map((a) => this.payments.view(a.payment.id))
    );

    return { ...this.toView(row, todayIn()), payments };
  }

  /** Recalcula status armazenado a partir dos pagamentos confirmados (DT-027). */
  private async refreshStatus(
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

  private assertCapacity(row: FeeRow, amount: Money): void {
    const { confirmed, pending } = paidOf(row);
    const available = remainingAmount(row.totalAmount, confirmed.plus(pending));

    if (amount.greaterThan(available)) {
      throw AppError.validation(
        'AMOUNT_EXCEEDS_BALANCE',
        `O valor excede o saldo em aberto desta mensalidade (R$ ${available.toFixed(2).replace('.', ',')}).`
      );
    }
  }

  /**
   * RF-013: registra pagamento manual. Com `accountId` e permissão de confirmação,
   * confirma e lança no Caixa na mesma transação; caso contrário fica pendente.
   */
  async recordPayment(
    actor: Principal,
    feeId: string,
    input: {
      amount: Money;
      paymentMethodId: string;
      paidOn: string;
      notes?: string;
      accountId?: string;
    },
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<FeeDetail> {
    const confirmNow = input.accountId !== undefined;

    if (confirmNow && !actor.permissions.has(PERMISSIONS.paymentsConfirm)) {
      throw AppError.forbidden('Você não tem permissão para confirmar pagamentos.');
    }

    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'monthlyFee', feeId);
      const row = await this.loadRow(tx, feeId);

      if (row.status === 'CANCELLED') {
        throw AppError.conflict('FEE_CANCELLED', 'Mensalidade cancelada não recebe pagamentos.');
      }

      const payment = await this.payments.createInTx(tx, actor.userId, {
        paymentMethodId: input.paymentMethodId,
        amount: input.amount,
        payerUserId: row.athlete.userId,
        paidAt: startOfDayInZone(input.paidOn),
        notes: input.notes ?? null,
        idempotencyKey: `fee-payment:${idempotencyKey}`
      });

      if (payment.replayed) {
        return;
      }

      this.assertCapacity(row, input.amount);
      await tx.monthlyFeePayment.create({
        data: {
          monthlyFeeId: feeId,
          paymentId: payment.id,
          allocatedAmount: input.amount,
          currency: row.currency,
          createdById: actor.userId
        }
      });

      if (confirmNow) {
        await this.confirmAllocated(tx, actor.userId, row, payment.id, input.accountId as string);
      }

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'fee.payment.recorded',
          entityType: 'MonthlyFee',
          entityId: feeId,
          after: { paymentId: payment.id, amount: input.amount.toFixed(2), confirmed: confirmNow },
          meta
        },
        tx
      );
    });

    return this.get(feeId);
  }

  private async confirmAllocated(
    tx: PrismaTx,
    actorId: string,
    row: FeeRow,
    paymentId: string,
    accountId: string
  ): Promise<void> {
    const month = dateToCivil(row.referenceMonth);

    await this.payments.confirmInTx(tx, actorId, paymentId, {
      accountId,
      categoryCode: SYSTEM_CATEGORY.monthlyFees,
      origin: 'MONTHLY_FEE',
      description: `Mensalidade ${month.slice(5, 7)}/${month.slice(0, 4)} — ${row.athlete.fullName}`
    });

    const { after } = await this.refreshStatus(tx, row.id);

    if (row.athlete.userId) {
      await this.notifications.notify(
        {
          userId: row.athlete.userId,
          type: 'fee.payment.confirmed',
          title: after === 'PAID' ? 'Mensalidade quitada' : 'Pagamento confirmado',
          message:
            after === 'PAID'
              ? `Sua mensalidade de ${month.slice(5, 7)}/${month.slice(0, 4)} está quitada. Obrigado!`
              : `Recebemos um pagamento parcial da mensalidade de ${month.slice(5, 7)}/${month.slice(0, 4)}.`,
          link: '/minha-conta/mensalidades',
          deduplicationKey: `fee-payment-confirmed:${paymentId}`
        },
        tx
      );
    }
  }

  /** Confirma pagamento pendente (ex.: comprovante PIX enviado pelo atleta). */
  async confirmPayment(
    actor: Principal,
    feeId: string,
    paymentId: string,
    accountId: string,
    meta: RequestMeta
  ): Promise<FeeDetail> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'monthlyFee', feeId);
      const row = await this.loadRow(tx, feeId);

      if (!row.paymentAllocations.some((a) => a.payment.id === paymentId)) {
        throw AppError.notFound('Pagamento não pertence a esta mensalidade.');
      }

      if (row.status === 'CANCELLED') {
        throw AppError.conflict('FEE_CANCELLED', 'Mensalidade cancelada não recebe pagamentos.');
      }

      await this.confirmAllocated(tx, actor.userId, row, paymentId, accountId);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'fee.payment.confirmed',
          entityType: 'MonthlyFee',
          entityId: feeId,
          after: { paymentId },
          meta
        },
        tx
      );
    });

    return this.get(feeId);
  }

  /** RN-MEN-007: pendente é cancelado; confirmado gera estorno vinculado. */
  async reversePayment(
    actor: Principal,
    feeId: string,
    paymentId: string,
    reason: string,
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<FeeDetail> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'monthlyFee', feeId);
      const row = await this.loadRow(tx, feeId);

      if (!row.paymentAllocations.some((a) => a.payment.id === paymentId)) {
        throw AppError.notFound('Pagamento não pertence a esta mensalidade.');
      }

      const status = await this.payments.reverseInTx(
        tx,
        actor.userId,
        paymentId,
        reason,
        idempotencyKey
      );
      const refreshed = await this.refreshStatus(tx, feeId);

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'fee.payment.reversed',
          entityType: 'MonthlyFee',
          entityId: feeId,
          reason,
          before: { status: refreshed.before },
          after: { status: refreshed.after, paymentStatus: status, paymentId },
          meta
        },
        tx
      );
    });

    return this.get(feeId);
  }

  /** Desconto/isenção manual e motivado (DT-027); total não fica abaixo do já pago. */
  async adjust(
    actor: Principal,
    feeId: string,
    input: { discountAmount?: Money; additionalAmount?: Money; reason: string },
    meta: RequestMeta
  ): Promise<FeeDetail> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'monthlyFee', feeId);
      const row = await this.loadRow(tx, feeId);

      if (row.status === 'CANCELLED') {
        throw AppError.conflict('FEE_CANCELLED', 'Mensalidade cancelada não pode ser ajustada.');
      }

      const discount = input.discountAmount ?? row.discountAmount;
      const additional = input.additionalAmount ?? row.additionalAmount;
      const total = feeTotal(row.originalAmount, discount, additional);
      const { confirmed, pending } = paidOf(row);

      if (total.lessThan(0)) {
        throw AppError.validation(
          'INVALID_DISCOUNT',
          'O desconto não pode ser maior que o valor da mensalidade.'
        );
      }

      if (total.lessThan(confirmed.plus(pending))) {
        throw AppError.conflict(
          'BELOW_PAID',
          'O novo total ficaria abaixo do valor já pago ou em análise.'
        );
      }

      await tx.monthlyFee.update({
        where: { id: feeId },
        data: { discountAmount: discount, additionalAmount: additional, totalAmount: total }
      });
      await this.refreshStatus(tx, feeId);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'fee.adjusted',
          entityType: 'MonthlyFee',
          entityId: feeId,
          reason: input.reason,
          before: {
            discount: row.discountAmount.toFixed(2),
            additional: row.additionalAmount.toFixed(2),
            total: row.totalAmount.toFixed(2)
          },
          after: {
            discount: discount.toFixed(2),
            additional: additional.toFixed(2),
            total: total.toFixed(2)
          },
          meta
        },
        tx
      );
    });

    return this.get(feeId);
  }

  /** Muda o vencimento de uma cobrança em aberto (COR-021); o atraso é recalculado na leitura. */
  async changeDueDate(
    actor: Principal,
    feeId: string,
    dueDate: string,
    reason: string,
    meta: RequestMeta
  ): Promise<FeeDetail> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'monthlyFee', feeId);
      const row = await this.loadRow(tx, feeId);

      if (row.status === 'CANCELLED' || row.status === 'PAID') {
        throw AppError.conflict(
          'FEE_CLOSED',
          'Só é possível alterar o vencimento de mensalidade em aberto.'
        );
      }

      await tx.monthlyFee.update({ where: { id: feeId }, data: { dueDate: civilToDate(dueDate) } });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'fee.due_date.changed',
          entityType: 'MonthlyFee',
          entityId: feeId,
          reason,
          before: { dueDate: dateToCivil(row.dueDate) },
          after: { dueDate },
          meta
        },
        tx
      );
    });

    return this.get(feeId);
  }

  async cancel(
    actor: Principal,
    feeId: string,
    reason: string,
    meta: RequestMeta
  ): Promise<FeeDetail> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'monthlyFee', feeId);
      const row = await this.loadRow(tx, feeId);
      const { confirmed, pending } = paidOf(row);

      if (row.status === 'CANCELLED') {
        throw AppError.conflict('FEE_CANCELLED', 'Mensalidade já cancelada.');
      }

      if (confirmed.plus(pending).greaterThan(0)) {
        throw AppError.conflict(
          'HAS_PAYMENTS',
          'Estorne ou cancele os pagamentos antes de cancelar a mensalidade.'
        );
      }

      await tx.monthlyFee.update({
        where: { id: feeId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledById: actor.userId,
          cancellationReason: reason
        }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'fee.cancelled',
          entityType: 'MonthlyFee',
          entityId: feeId,
          reason,
          before: { status: row.status },
          after: { status: 'CANCELLED' },
          meta
        },
        tx
      );
    });

    return this.get(feeId);
  }

  // ---------- Área do atleta ----------

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

  /** Atleta envia comprovante PIX; fica pendente até a diretoria confirmar. */
  async submitProof(
    principal: Principal,
    feeId: string,
    input: { amount: Money; paidOn: string; notes?: string },
    file: IncomingFile | undefined,
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<FeeDetail> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'monthlyFee', feeId);
      const row = await this.loadRow(tx, feeId);

      if (row.athlete.userId !== principal.userId) {
        throw AppError.notFound('Mensalidade não encontrada.');
      }

      if (row.status === 'CANCELLED' || row.status === 'PAID') {
        throw AppError.conflict('FEE_CLOSED', 'Esta mensalidade não está em aberto.');
      }

      const pix = await tx.paymentMethod.findUnique({
        where: { code: 'pix' },
        select: { id: true }
      });

      if (pix === null) {
        throw new Error('Forma de pagamento PIX ausente: execute npm run db:seed.');
      }

      const payment = await this.payments.createInTx(tx, principal.userId, {
        paymentMethodId: pix.id,
        amount: input.amount,
        payerUserId: principal.userId,
        paidAt: startOfDayInZone(input.paidOn),
        notes: input.notes ?? null,
        idempotencyKey: `fee-proof:${idempotencyKey}`
      });

      if (payment.replayed) {
        return;
      }

      this.assertCapacity(row, input.amount);
      const stored = await this.media.store(
        file,
        { ...DOCUMENT_POLICY, kind: 'RECEIPT', classification: 'CONFIDENTIAL' },
        principal.userId,
        tx
      );

      await tx.financialTransactionAttachment.create({
        data: { paymentId: payment.id, mediaFileId: stored.id, type: 'RECEIPT' }
      });
      await tx.monthlyFeePayment.create({
        data: {
          monthlyFeeId: feeId,
          paymentId: payment.id,
          allocatedAmount: input.amount,
          currency: row.currency,
          createdById: principal.userId
        }
      });
      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'fee.proof.submitted',
          entityType: 'MonthlyFee',
          entityId: feeId,
          after: { paymentId: payment.id, amount: input.amount.toFixed(2) },
          meta
        },
        tx
      );
    });

    return this.get(feeId, principal.userId);
  }

  /** Comprovante de pagamento: dono do pagamento ou quem tem `fees.read`. */
  async paymentAttachment(principal: Principal, paymentId: string, attachmentId: string) {
    const attachment = await this.prisma.financialTransactionAttachment.findFirst({
      where: { id: attachmentId, paymentId, deletedAt: null },
      select: { mediaFileId: true, payment: { select: { payerUserId: true } } }
    });

    if (attachment === null) {
      throw AppError.notFound('Comprovante não encontrado.');
    }

    const allowed =
      principal.permissions.has(PERMISSIONS.feesRead) ||
      attachment.payment?.payerUserId === principal.userId;

    if (!allowed) {
      throw AppError.notFound('Comprovante não encontrado.');
    }

    return this.media.read(attachment.mediaFileId, principal, true);
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
