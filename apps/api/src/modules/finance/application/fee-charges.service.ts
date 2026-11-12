import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import {
  civilToDate,
  dateToCivil,
  daysInMonth,
  optionalCivil
} from '../../../common/domain/civil-date';
import { formatBrl, type Money, round2 } from '../../../common/domain/money';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { dueDateFor, feeTotal, planCoversMonth } from '../domain/finance-rules';
import { lockRow } from './ledger.service';
import { FeeDetail, paidOf, monthOf } from './fee-view';
import { FeeReader } from './fee-view';

/**
 * Cobranças de mensalidade (RF-012, DT-027): geração do mês, desconto ou isenção motivados,
 * troca de vencimento e cancelamento. O valor original da cobrança é preservado.
 */
@Injectable()
export class FeeChargesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly reader: FeeReader
  ) {}

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
            message: `Mensalidade de ${referenceMonth.slice(5, 7)}/${referenceMonth.slice(0, 4)} no valor de ${formatBrl(amount)}.`,
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

  /** Desconto/isenção manual e motivado (DT-027); total não fica abaixo do já pago. */
  async adjust(
    actor: Principal,
    feeId: string,
    input: { discountAmount?: Money; additionalAmount?: Money; reason: string },
    meta: RequestMeta
  ): Promise<FeeDetail> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'monthlyFee', feeId);
      const row = await this.reader.loadRow(tx, feeId);

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
      await this.reader.refreshStatus(tx, feeId);
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

    return this.reader.get(feeId);
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
      const row = await this.reader.loadRow(tx, feeId);

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

    return this.reader.get(feeId);
  }

  async cancel(
    actor: Principal,
    feeId: string,
    reason: string,
    meta: RequestMeta
  ): Promise<FeeDetail> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'monthlyFee', feeId);
      const row = await this.reader.loadRow(tx, feeId);
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

    return this.reader.get(feeId);
  }
}
