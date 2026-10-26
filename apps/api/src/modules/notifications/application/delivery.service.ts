import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import type { NotificationChannel, Prisma } from '../../../generated/prisma/client';

import { AppConfig } from '../../../common/config/app-config';
import { TEAM_TIME_ZONE } from '../../../common/domain/time-zone';
import { JobScheduler } from '../../../common/jobs/job-scheduler';
import { MailSender } from '../../../common/mail/mail.service';
import { DeliveryError, type SendResult } from '../../../common/messaging/delivery-error';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { WhatsAppSender } from '../../../common/whatsapp/whatsapp.service';
import {
  categoryOf,
  emailText,
  type ExternalChannel,
  firstName,
  type OutgoingContent,
  preferenceEnabled,
  retryDelayMs,
  whatsappNumber,
  whatsappParameters,
  whatsappSendAt
} from '../domain/channel-rules';

const BATCH_SIZE = 25;
const SEND_LEASE_MS = 5 * 60_000;
const POLL_INTERVAL_MS = 30_000;
const KICK_DELAY_MS = 2_000;

const DELIVERY_INCLUDE = {
  notification: {
    select: {
      type: true,
      title: true,
      message: true,
      payload: true,
      deletedAt: true,
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          status: true,
          deletedAt: true,
          whatsappOptInAt: true,
          athlete: { select: { phone: true } },
          notificationPreferences: { select: { category: true, channel: true, enabled: true } }
        }
      }
    }
  }
} satisfies Prisma.NotificationDeliveryInclude;

type DeliveryRow = Prisma.NotificationDeliveryGetPayload<{ include: typeof DELIVERY_INCLUDE }>;

type Outcome =
  | { readonly kind: 'sent'; readonly result: SendResult }
  | { readonly kind: 'cancelled'; readonly code: string }
  | { readonly kind: 'deferred'; readonly until: Date };

export interface DeliverySummary {
  /** `smtp` envia de verdade; `teste` grava em arquivo. */
  readonly email: 'smtp' | 'teste';
  readonly whatsapp: 'cloud' | 'teste' | 'desligado';
  readonly whatsappConsents: number;
  /** Últimos 7 dias, por canal e situação. */
  readonly lastWeek: { channel: string; status: string; count: number }[];
  /** Falhas recentes, sem destinatário nem conteúdo. */
  readonly recentFailures: { channel: string; code: string | null; type: string; at: string }[];
}

/** Telefone da conta ou, se vazio, do cadastro de atleta da mesma pessoa. */
export function recipientPhone(user: {
  phone: string | null;
  athlete: { phone: string | null } | null;
}): string | null {
  return user.phone ?? user.athlete?.phone ?? null;
}

/**
 * Fila de avisos por e-mail e WhatsApp (DT-048). Cada servidor reserva lotes com
 * `FOR UPDATE SKIP LOCKED`, então nenhum envio sai duas vezes. Destino, consentimento e
 * preferência são conferidos de novo na hora do envio.
 */
@Injectable()
export class DeliveryService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Avisos');
  private running = false;
  private kickTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly mail: MailSender,
    private readonly whatsapp: WhatsAppSender,
    private readonly jobs: JobScheduler
  ) {}

  onModuleInit(): void {
    this.jobs.every('notifications.deliver', POLL_INTERVAL_MS, () => this.processDue());
  }

  onApplicationShutdown(): void {
    if (this.kickTimer) {
      clearTimeout(this.kickTimer);
    }
  }

  async summary(now: Date = new Date()): Promise<DeliverySummary> {
    const since = new Date(now.getTime() - 7 * 24 * 3_600_000);
    const [groups, failures, consents] = await Promise.all([
      this.prisma.notificationDelivery.groupBy({
        by: ['channel', 'status'],
        where: { createdAt: { gte: since } },
        _count: { _all: true }
      }),
      this.prisma.notificationDelivery.findMany({
        where: { status: 'FAILED' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          channel: true,
          failureCode: true,
          updatedAt: true,
          notification: { select: { type: true } }
        }
      }),
      this.prisma.user.count({ where: { whatsappOptInAt: { not: null }, deletedAt: null } })
    ]);
    const { mailDriver, whatsappDriver } = this.config.values;

    return {
      email: mailDriver === 'smtp' ? 'smtp' : 'teste',
      whatsapp:
        whatsappDriver === 'cloud' ? 'cloud' : whatsappDriver === 'outbox' ? 'teste' : 'desligado',
      whatsappConsents: consents,
      lastWeek: groups.map((group) => ({
        channel: group.channel,
        status: group.status,
        count: group._count._all
      })),
      recentFailures: failures.map((failure) => ({
        channel: failure.channel,
        code: failure.failureCode,
        type: failure.notification.type,
        at: failure.updatedAt.toISOString()
      }))
    };
  }

  /** Canais externos que podem sair agora (WhatsApp desligado não entra na fila). */
  availableChannels(): ReadonlySet<ExternalChannel> {
    return new Set<ExternalChannel>(this.whatsapp.enabled ? ['EMAIL', 'WHATSAPP'] : ['EMAIL']);
  }

  /** Processa a fila logo depois de um aviso novo, sem esperar a rodada periódica. */
  kick(): void {
    if (this.kickTimer || process.env['NODE_ENV'] === 'test') {
      return;
    }

    this.kickTimer = setTimeout(() => {
      this.kickTimer = null;
      void this.processDue().catch((error: unknown) => {
        this.logger.error(`Falha ao processar a fila: ${(error as Error).name}.`);
      });
    }, KICK_DELAY_MS);
    this.kickTimer.unref();
  }

  /** Envia o que está vencido na fila. Devolve quantas entregas foram tratadas. */
  async processDue(now: Date = new Date()): Promise<number> {
    if (this.running) {
      return 0;
    }

    this.running = true;

    try {
      let handled = 0;
      let claimed: string[];

      do {
        claimed = await this.claim();

        for (const id of claimed) {
          await this.deliver(id, now);
        }

        handled += claimed.length;
      } while (claimed.length === BATCH_SIZE);

      return handled;
    } finally {
      this.running = false;
    }
  }

  private async claim(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE "notification_deliveries" SET
        "status" = 'SENDING',
        "attempts" = "attempts" + 1,
        "locked_until" = now() + ${SEND_LEASE_MS}::double precision * interval '1 millisecond',
        "updated_at" = now()
      WHERE "id" IN (
        SELECT "id" FROM "notification_deliveries"
        WHERE ("status" = 'PENDING' AND "next_attempt_at" <= now())
           OR ("status" = 'SENDING' AND "locked_until" < now())
        ORDER BY "next_attempt_at"
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id"`;

    return rows.map((row) => row.id);
  }

  private async deliver(id: string, now: Date): Promise<void> {
    const row = await this.prisma.notificationDelivery.findUnique({
      where: { id },
      include: DELIVERY_INCLUDE
    });

    if (!row) {
      return;
    }

    let outcome: Outcome;

    try {
      outcome = await this.attempt(row, now);
    } catch (error) {
      const failure =
        error instanceof DeliveryError ? error : new DeliveryError('ERRO_INTERNO', false);
      const delay = failure.permanent ? null : retryDelayMs(row.attempts);

      if (!(error instanceof DeliveryError)) {
        this.logger.error(`Envio ${id} falhou: ${(error as Error).name}.`);
      }

      await this.prisma.notificationDelivery.update({
        where: { id },
        data:
          delay === null
            ? { status: 'FAILED', failureCode: failure.code, lockedUntil: null }
            : {
                status: 'PENDING',
                failureCode: failure.code,
                lockedUntil: null,
                // Relógio real, o mesmo da reserva no banco (`now` só decide o horário do WhatsApp).
                nextAttemptAt: new Date(Date.now() + delay)
              }
      });

      return;
    }

    await this.prisma.notificationDelivery.update({
      where: { id },
      data:
        outcome.kind === 'sent'
          ? {
              status: 'SENT',
              sentAt: new Date(),
              lockedUntil: null,
              failureCode: null,
              providerMessageId: outcome.result.providerMessageId
            }
          : outcome.kind === 'cancelled'
            ? { status: 'CANCELLED', failureCode: outcome.code, lockedUntil: null }
            : // Fora do horário: volta para a fila sem gastar tentativa.
              {
                status: 'PENDING',
                lockedUntil: null,
                attempts: { decrement: 1 },
                nextAttemptAt: outcome.until
              }
    });
  }

  private async attempt(row: DeliveryRow, now: Date): Promise<Outcome> {
    const { notification } = row;
    const { user } = notification;
    const channel = row.channel as Exclude<NotificationChannel, 'IN_APP'>;

    if (notification.deletedAt) {
      return { kind: 'cancelled', code: 'AVISO_REMOVIDO' };
    }

    if (user.deletedAt || user.status !== 'ACTIVE') {
      return { kind: 'cancelled', code: 'CONTA_INATIVA' };
    }

    if (!preferenceEnabled(user.notificationPreferences, categoryOf(notification.type), channel)) {
      return { kind: 'cancelled', code: 'PREFERENCIA_DESLIGADA' };
    }

    const content = this.content(user.name, notification);

    if (channel === 'EMAIL') {
      return {
        kind: 'sent',
        result: await this.mail.send({ to: user.email, ...emailText(content) })
      };
    }

    if (!this.whatsapp.enabled) {
      return { kind: 'cancelled', code: 'WHATSAPP_DESLIGADO' };
    }

    if (!user.whatsappOptInAt) {
      return { kind: 'cancelled', code: 'SEM_CONSENTIMENTO' };
    }

    const to = whatsappNumber(recipientPhone(user));

    if (!to) {
      return { kind: 'cancelled', code: 'SEM_CELULAR' };
    }

    const allowedAt = whatsappSendAt(now, TEAM_TIME_ZONE);

    if (allowedAt.getTime() > now.getTime()) {
      return { kind: 'deferred', until: allowedAt };
    }

    return {
      kind: 'sent',
      result: await this.whatsapp.send({ to, parameters: whatsappParameters(content) })
    };
  }

  private content(
    name: string,
    notification: { title: string; message: string; payload: Prisma.JsonValue }
  ): OutgoingContent {
    const origin = this.config.values.webOrigin.replace(/\/$/, '');
    const link = (notification.payload as { link?: unknown } | null)?.link;
    const path = typeof link === 'string' && link.startsWith('/') ? link : '/minha-conta';

    return {
      firstName: firstName(name),
      title: notification.title,
      message: notification.message,
      url: `${origin}${path}`,
      preferencesUrl: `${origin}/minha-conta/notificacoes`
    };
  }
}
