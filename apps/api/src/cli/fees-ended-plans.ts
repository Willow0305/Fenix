import { civilToDate, monthStart, todayIn } from '../common/domain/civil-date';
import { createPrismaClient } from '../common/prisma/prisma.service';

/**
 * Aplica a regra da DT-066 a planos excluídos antes dela: cancela as mensalidades do mês
 * atual em diante sem nenhum pagamento e encerra hoje os vínculos de atletas que ficaram
 * abertos. Meses passados e cobranças com pagamento nunca mudam (dívida real).
 *
 * Por padrão só simula e mostra o que faria; grava com `--apply`. Cada mudança gera
 * auditoria `maintenance.fee_plan.*`.
 */
const REASON = 'Plano excluído antes da regra de encerramento (DT-066).';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = createPrismaClient();

  try {
    const today = todayIn();
    const plans = await prisma.monthlyFeePlan.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, name: true }
    });
    let fees = 0;
    let links = 0;

    for (const plan of plans) {
      await prisma.$transaction(async (tx) => {
        const cancellable = await tx.monthlyFee.findMany({
          where: {
            monthlyFeePlanId: plan.id,
            status: { in: ['OPEN', 'OVERDUE'] },
            referenceMonth: { gte: civilToDate(monthStart(today)) },
            paymentAllocations: { none: {} }
          },
          select: { id: true, status: true }
        });
        const open = await tx.athleteMonthlyFeePlan.findMany({
          where: { monthlyFeePlanId: plan.id, status: 'ACTIVE', endsOn: null },
          select: { id: true, athleteId: true, startsOn: true }
        });

        fees += cancellable.length;
        links += open.length;

        if (!apply || (cancellable.length === 0 && open.length === 0)) {
          return;
        }

        const now = new Date();

        await tx.monthlyFee.updateMany({
          where: { id: { in: cancellable.map((fee) => fee.id) } },
          data: { status: 'CANCELLED', cancelledAt: now, cancellationReason: REASON }
        });

        for (const link of open) {
          // Vínculo que ainda nem começou termina no próprio início.
          const endsOn = link.startsOn > civilToDate(today) ? link.startsOn : civilToDate(today);

          await tx.athleteMonthlyFeePlan.update({
            where: { id: link.id },
            data: { endsOn, status: 'ENDED' }
          });
        }

        await tx.auditLog.create({
          data: {
            action: 'maintenance.fee_plan.ended',
            entityType: 'MonthlyFeePlan',
            entityId: plan.id,
            reason: REASON,
            afterData: {
              cancelledFees: cancellable.map((fee) => fee.id),
              endedAthletePlans: open.map((link) => link.id)
            }
          }
        });
      });
    }

    console.log(
      `${apply ? 'Aplicado' : 'Simulação'}: ${plans.length} plano(s) excluído(s), ${fees} mensalidade(s) futura(s) sem pagamento a cancelar, ${links} vínculo(s) de atleta a encerrar.${apply ? '' : ' Rode com --apply para gravar.'}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha ao aplicar a regra dos planos.');
  process.exitCode = 1;
});
