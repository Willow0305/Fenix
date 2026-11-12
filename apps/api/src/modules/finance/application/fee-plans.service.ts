import { Injectable } from '@nestjs/common';
import type { MonthlyFeePlanStatus } from '../../../generated/prisma/client';
import { AuditService } from '../../../common/audit/audit.service';
import {
  addDays,
  civilToDate,
  dateToCivil,
  optionalCivil,
  todayIn
} from '../../../common/domain/civil-date';
import { DEFAULT_CURRENCY, type Money, moneyView } from '../../../common/domain/money';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import {
  PlanView,
  PlanEndEffects,
  PlanImpact,
  cancellablePlanFees,
  AthletePlanView,
  PlanMemberView,
  BulkAssignResult,
  PlanRow
} from './fee-view';

/**
 * Planos de mensalidade (RF-011, DT-027): cadastro, vínculo do atleta ao plano, vínculo em
 * lote, encerramento e o efeito do fim do plano nas cobranças futuras.
 */
@Injectable()
export class FeePlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

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
      reason?: string;
    } & PlanEndEffects,
    meta: RequestMeta
  ): Promise<PlanView> {
    const before = await this.prisma.monthlyFeePlan.findFirst({ where: { id, deletedAt: null } });

    if (before === null) {
      throw AppError.notFound('Plano não encontrado.');
    }

    const deactivating = before.status === 'ACTIVE' && input.status === 'INACTIVE';
    const effects = deactivating
      ? {
          cancelFutureFees: input.cancelFutureFees === true,
          endAthletePlans: input.endAthletePlans === true
        }
      : {};

    if ((effects.cancelFutureFees || effects.endAthletePlans) && !input.reason?.trim()) {
      throw AppError.validation('REASON_REQUIRED', 'Informe o motivo da inativação.');
    }

    const applied = await this.prisma.$transaction(async (tx) => {
      await tx.monthlyFeePlan.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.description === undefined ? {} : { description: input.description || null }),
          ...(input.amount === undefined ? {} : { amount: input.amount }),
          ...(input.dueDay === undefined ? {} : { dueDay: input.dueDay }),
          ...(input.status === undefined ? {} : { status: input.status })
        }
      });

      return this.applyPlanEndEffects(tx, actor, id, effects, input.reason ?? '', meta);
    });
    const { reason, cancelFutureFees, endAthletePlans, ...changes } = input;

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'fee_plan.updated',
      entityType: 'MonthlyFeePlan',
      entityId: id,
      reason: reason ?? null,
      before: {
        name: before.name,
        amount: before.amount.toFixed(2),
        dueDay: before.dueDay,
        status: before.status
      },
      after: {
        ...changes,
        ...(input.amount ? { amount: input.amount.toFixed(2) } : {}),
        ...(deactivating ? { cancelFutureFees, endAthletePlans, ...applied } : {})
      },
      meta
    });

    return (await this.plans()).find((p) => p.id === id) as PlanView;
  }

  /** Impacto de inativar ou excluir o plano (DT-066), para o diálogo de confirmação. */
  async planImpact(id: string): Promise<PlanImpact> {
    const exists = await this.prisma.monthlyFeePlan.count({ where: { id, deletedAt: null } });

    if (exists === 0) {
      throw AppError.notFound('Plano não encontrado.');
    }

    const [activeAthletes, cancellableFees, openFees] = await Promise.all([
      this.prisma.athleteMonthlyFeePlan.count({
        where: { monthlyFeePlanId: id, status: 'ACTIVE', endsOn: null }
      }),
      this.prisma.monthlyFee.count({ where: cancellablePlanFees(id) }),
      this.prisma.monthlyFee.count({
        where: { monthlyFeePlanId: id, status: { in: ['OPEN', 'OVERDUE', 'PARTIALLY_PAID'] } }
      })
    ]);

    return { activeAthletes, cancellableFees, keptOpenFees: openFees - cancellableFees };
  }

  /**
   * Efeitos de encerrar um plano, no mesmo instante e com o mesmo motivo. Nunca cancela
   * mensalidade com pagamento nem de mês passado (dívida real); cada mudança é auditada.
   */
  async applyPlanEndEffects(
    tx: PrismaTx,
    actor: Principal | null,
    planId: string,
    effects: PlanEndEffects,
    reason: string,
    meta: RequestMeta,
    origin = 'fee_plan.ended'
  ): Promise<{ cancelledFees: number; endedAthletePlans: number }> {
    let cancelledFees = 0;
    let endedAthletePlans = 0;

    if (effects.cancelFutureFees) {
      const fees = await tx.monthlyFee.findMany({
        where: cancellablePlanFees(planId),
        select: { id: true, status: true }
      });

      for (const fee of fees) {
        await tx.monthlyFee.update({
          where: { id: fee.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledById: actor?.userId ?? null,
            cancellationReason: reason
          }
        });
        await this.audit.record(
          {
            actorUserId: actor?.userId ?? null,
            action: 'fee.cancelled',
            entityType: 'MonthlyFee',
            entityId: fee.id,
            reason,
            before: { status: fee.status },
            after: { status: 'CANCELLED', origin },
            meta
          },
          tx
        );
      }

      cancelledFees = fees.length;
    }

    if (effects.endAthletePlans) {
      const today = todayIn();
      const links = await tx.athleteMonthlyFeePlan.findMany({
        where: { monthlyFeePlanId: planId, status: 'ACTIVE', endsOn: null },
        select: { id: true, athleteId: true, startsOn: true }
      });

      for (const link of links) {
        const startsOn = dateToCivil(link.startsOn);
        const endsOn = startsOn > today ? startsOn : today;

        await tx.athleteMonthlyFeePlan.update({
          where: { id: link.id },
          data: { endsOn: civilToDate(endsOn), status: 'ENDED' }
        });
        await this.audit.record(
          {
            actorUserId: actor?.userId ?? null,
            action: 'athlete_plan.ended',
            entityType: 'Athlete',
            entityId: link.athleteId,
            reason,
            after: { athletePlanId: link.id, endsOn, origin },
            meta
          },
          tx
        );
      }

      endedAthletePlans = links.length;
    }

    return { cancelledFees, endedAthletePlans };
  }

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
   * Exclusão lógica do plano (DT-066). Plano excluído não pode continuar cobrando: as
   * mensalidades do mês atual em diante sem pagamento são canceladas e os vínculos vigentes
   * terminam hoje. Meses passados e cobranças com pagamento continuam (dívida real).
   */
  async deletePlan(actor: Principal, id: string, reason: string, meta: RequestMeta): Promise<void> {
    const plan = await this.prisma.monthlyFeePlan.findFirst({ where: { id, deletedAt: null } });

    if (plan === null) {
      throw AppError.notFound('Plano não encontrado.');
    }

    await this.prisma.$transaction(async (tx) => {
      const applied = await this.applyPlanEndEffects(
        tx,
        actor,
        id,
        { cancelFutureFees: true, endAthletePlans: true },
        reason,
        meta,
        'fee_plan.deleted'
      );

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
          after: applied,
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
}
