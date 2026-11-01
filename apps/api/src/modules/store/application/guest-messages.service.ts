import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';

import { AppConfig } from '../../../common/config/app-config';
import { decryptField } from '../../../common/crypto/data-cipher';
import { TEAM_TIME_ZONE } from '../../../common/domain/time-zone';
import { JobScheduler } from '../../../common/jobs/job-scheduler';
import { MailSender } from '../../../common/mail/mail.service';
import { DeliveryError, type SendResult } from '../../../common/messaging/delivery-error';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { WhatsAppSender } from '../../../common/whatsapp/whatsapp.service';
import {
  firstName,
  retryDelayMs,
  whatsappNumber,
  whatsappParameters,
  whatsappSendAt
} from '../../notifications/domain/channel-rules';
import { guestOrderPath } from '../domain/guest-access';

const BATCH_SIZE = 25;
const SEND_LEASE_MS = 5 * 60_000;
const POLL_INTERVAL_MS = 30_000;
const KICK_DELAY_MS = 2_000;

/** Dados do pedido que decidem quem recebe o aviso. */
export interface GuestRecipient {
  readonly id: string;
  readonly customerUserId: string | null;
  readonly customerEmail: string | null;
  readonly customerPhone: string | null;
  readonly guestWhatsappOptInAt: Date | null;
}

const MESSAGE_INCLUDE = {
  order: {
    select: {
      orderNumber: true,
      customerUserId: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      guestWhatsappOptInAt: true,
      guestAccessCodeEncrypted: true
    }
  }
} satisfies Prisma.GuestOrderMessageInclude;

type MessageRow = Prisma.GuestOrderMessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

type Outcome =
  | { readonly kind: 'sent'; readonly result: SendResult }
  | { readonly kind: 'cancelled'; readonly code: string }
  | { readonly kind: 'deferred'; readonly until: Date };

/**
 * Avisos do pedido para quem comprou sem conta (DT-096), por e-mail e, com consentimento,
 * por WhatsApp. Quem tem conta recebe pelos avisos da conta (DT-048). A mensagem entra na
 * fila na mesma transação da mudança do pedido e sai em segundo plano, com novas tentativas;
 * cada uma leva o link fixo do pedido.
 */
@Injectable()
export class GuestMessagesService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('AvisosSemConta');
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
    this.jobs.every('store.guest-messages', POLL_INTERVAL_MS, () => this.processDue());
  }

  onApplicationShutdown(): void {
    if (this.kickTimer) {
      clearTimeout(this.kickTimer);
    }
  }

  /** Põe o aviso na fila; repetir o mesmo motivo não duplica. Pedido com conta é ignorado. */
  async enqueue(
    client: PrismaTx | PrismaService,
    order: GuestRecipient,
    kind: string,
    title: string,
    message: string
  ): Promise<void> {
    if (order.customerUserId) {
      return;
    }

    const channels = [
      ...(order.customerEmail ? (['EMAIL'] as const) : []),
      ...(order.guestWhatsappOptInAt && order.customerPhone ? (['WHATSAPP'] as const) : [])
    ];

    if (channels.length === 0) {
      return;
    }

    await client.guestOrderMessage.createMany({
      data: channels.map((channel) => ({ orderId: order.id, channel, kind, title, message })),
      skipDuplicates: true
    });
    this.kick();
  }

  /** Atalho para quem só tem o id do pedido. */
  async enqueueForOrder(
    client: PrismaTx | PrismaService,
    orderId: string,
    kind: string,
    title: string,
    message: string
  ): Promise<void> {
    const order = await client.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerUserId: true,
        customerEmail: true,
        customerPhone: true,
        guestWhatsappOptInAt: true
      }
    });

    if (order) {
      await this.enqueue(client, order, kind, title, message);
    }
  }

  /** Envia logo depois da transação, sem esperar a próxima passada da fila. */
  private kick(): void {
    if (this.kickTimer) {
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
      UPDATE "guest_order_messages" SET
        "status" = 'SENDING',
        "attempts" = "attempts" + 1,
        "locked_until" = now() + ${SEND_LEASE_MS}::double precision * interval '1 millisecond',
        "updated_at" = now()
      WHERE "id" IN (
        SELECT "id" FROM "guest_order_messages"
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
    const row = await this.prisma.guestOrderMessage.findUnique({
      where: { id },
      include: MESSAGE_INCLUDE
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

      await this.prisma.guestOrderMessage.update({
        where: { id },
        data:
          delay === null
            ? { status: 'FAILED', failureCode: failure.code, lockedUntil: null }
            : {
                status: 'PENDING',
                failureCode: failure.code,
                lockedUntil: null,
                nextAttemptAt: new Date(Date.now() + delay)
              }
      });

      return;
    }

    await this.prisma.guestOrderMessage.update({
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
            : // Fora do horário do WhatsApp: volta para a fila sem gastar tentativa.
              {
                status: 'PENDING',
                lockedUntil: null,
                attempts: { decrement: 1 },
                nextAttemptAt: outcome.until
              }
    });
  }

  /** Link fixo do pedido; sem o código guardado (pedido antigo), a página de consulta. */
  orderUrl(order: { orderNumber: string; guestAccessCodeEncrypted: string | null }): string {
    const origin = this.config.values.webOrigin.replace(/\/$/, '');

    if (!order.guestAccessCodeEncrypted) {
      return `${origin}/loja/pedido`;
    }

    const code = decryptField(order.guestAccessCodeEncrypted, this.config.values.dataEncryptionKey);

    return `${origin}${guestOrderPath(order.orderNumber, code)}`;
  }

  private async attempt(row: MessageRow, now: Date): Promise<Outcome> {
    const { order } = row;

    // Pedido trazido para uma conta depois: os avisos passam a ir pela conta.
    if (order.customerUserId) {
      return { kind: 'cancelled', code: 'PEDIDO_EM_CONTA' };
    }

    const url = this.orderUrl(order);
    const name = firstName(order.customerName);

    if (row.channel === 'EMAIL') {
      if (!order.customerEmail) {
        return { kind: 'cancelled', code: 'SEM_EMAIL' };
      }

      return {
        kind: 'sent',
        result: await this.mail.send({
          to: order.customerEmail,
          subject: `${row.title} — Fênix Vôlei`,
          text: [
            `Olá, ${name}.`,
            '',
            row.message,
            '',
            `Acompanhe o pedido ${order.orderNumber} por este link, que não muda: ${url}`,
            '',
            '—',
            'Fênix Vôlei. Mensagem automática sobre a sua compra na loja do clube; para falar com a diretoria, use os contatos do site.'
          ].join('\n')
        })
      };
    }

    if (!this.whatsapp.enabled) {
      return { kind: 'cancelled', code: 'WHATSAPP_DESLIGADO' };
    }

    if (!order.guestWhatsappOptInAt) {
      return { kind: 'cancelled', code: 'SEM_CONSENTIMENTO' };
    }

    const to = whatsappNumber(order.customerPhone);

    if (!to) {
      return { kind: 'cancelled', code: 'SEM_CELULAR' };
    }

    const allowedAt = whatsappSendAt(now, TEAM_TIME_ZONE);

    if (allowedAt.getTime() > now.getTime()) {
      return { kind: 'deferred', until: allowedAt };
    }

    return {
      kind: 'sent',
      result: await this.whatsapp.send({
        to,
        parameters: whatsappParameters({
          firstName: name,
          title: row.title,
          message: row.message,
          url,
          preferencesUrl: url
        })
      })
    };
  }
}
