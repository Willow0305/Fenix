import { Injectable, type OnModuleInit } from '@nestjs/common';

import { civilToDate, dateToCivil, todayIn } from '../../../common/domain/civil-date';
import { TEAM_TIME_ZONE } from '../../../common/domain/time-zone';
import { JobScheduler } from '../../../common/jobs/job-scheduler';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import {
  feeReminderDueDates,
  feeReminderKind,
  feeReminderText
} from '../../notifications/domain/channel-rules';

/** Lembretes saem das 9h às 19h no fuso do clube; a rodada é de hora em hora. */
const SEND_FROM_HOUR = 9;
const SEND_UNTIL_HOUR = 19;
const INTERVAL_MS = 60 * 60_000;

/**
 * Lembretes de mensalidade em aberto (DT-048): 3 dias antes, no dia, 1 e 7 dias depois do
 * vencimento, ao titular da conta ligada ao atleta. Cada lembrete sai uma vez por
 * mensalidade e tipo; o canal (painel, e-mail, WhatsApp) segue a escolha da pessoa.
 */
@Injectable()
export class FeeRemindersService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobScheduler
  ) {}

  onModuleInit(): void {
    this.jobs.every('finance.fee-reminders', INTERVAL_MS, () => this.run());
  }

  /** Devolve quantos lembretes novos foram criados. */
  async run(now: Date = new Date()): Promise<number> {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: TEAM_TIME_ZONE,
        hour: '2-digit',
        hourCycle: 'h23'
      }).format(now)
    );

    if (hour < SEND_FROM_HOUR || hour >= SEND_UNTIL_HOUR) {
      return 0;
    }

    const today = todayIn(TEAM_TIME_ZONE, now);
    const fees = await this.prisma.monthlyFee.findMany({
      where: {
        status: { in: ['OPEN', 'PARTIALLY_PAID'] },
        dueDate: { in: feeReminderDueDates(today).map(civilToDate) },
        athlete: { deletedAt: null, userId: { not: null } }
      },
      select: {
        id: true,
        referenceMonth: true,
        dueDate: true,
        athlete: { select: { userId: true } }
      }
    });
    const inputs = fees.flatMap((fee) => {
      const dueDate = dateToCivil(fee.dueDate);
      const kind = feeReminderKind(dueDate, today);
      const userId = fee.athlete.userId;

      if (!kind || !userId) {
        return [];
      }

      return [
        {
          userId,
          type: `fee.reminder.${kind}`,
          ...feeReminderText(kind, dateToCivil(fee.referenceMonth), dueDate),
          link: '/minha-conta/mensalidades',
          deduplicationKey: `fee-reminder:${fee.id}:${kind}`
        }
      ];
    });

    return this.notifications.notify(inputs);
  }
}
