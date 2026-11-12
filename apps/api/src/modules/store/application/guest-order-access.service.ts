import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AppConfig } from '../../../common/config/app-config';
import { normalizeEmail } from '../../auth/domain/auth-rules';
import { decryptField, encryptField } from '../../../common/crypto/data-cipher';
import { formatGuestCode, generateGuestCode, guestCodeHash } from '../domain/guest-access';
import { whatsappNumber } from '../../notifications/domain/channel-rules';
import { GuestMessagesService } from './guest-messages.service';
import { OrderView, ORDER_INCLUDE } from './order-view';
import { OrderReader } from './order-view';

/**
 * Pedido de quem compra sem conta (DT-096): consulta por número e código, trazer para a conta,
 * reenvio do acesso e avisos por WhatsApp.
 */
@Injectable()
export class GuestOrderAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
    private readonly guestMessages: GuestMessagesService,
    private readonly reader: OrderReader
  ) {}

  /** Consulta segura de visitante: número + código secreto, resposta idêntica para erro. */
  async guestLookup(orderNumber: string, code: string): Promise<OrderView> {
    const row = await this.prisma.order.findFirst({
      where: {
        orderNumber: orderNumber.trim().toUpperCase(),
        guestAccessTokenHash: guestCodeHash(code)
      },
      include: ORDER_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Pedido não encontrado. Confira o número e o código.');
    }

    return this.reader.withPaymentInfo(await this.reader.toView(row, undefined, true));
  }

  /**
   * O comprador cancela o próprio pedido enquanto não pagou (DT-076): sem comprovante em
   * análise. Depois de pago, vale a desistência em 7 dias (DT-070).
   */
  /**
   * Quem está logado traz para a conta um pedido feito sem conta, com o número e o código
   * (DT-096). Pedido já de outra conta não muda.
   */
  async claimGuestOrder(
    principal: Principal,
    orderNumber: string,
    code: string,
    meta: RequestMeta
  ): Promise<OrderView> {
    const found = await this.prisma.order.findFirst({
      where: {
        orderNumber: orderNumber.trim().toUpperCase(),
        guestAccessTokenHash: guestCodeHash(code)
      },
      select: { id: true, customerUserId: true }
    });

    if (found === null) {
      throw AppError.notFound('Pedido não encontrado. Confira o número e o código.');
    }

    if (found.customerUserId !== null && found.customerUserId !== principal.userId) {
      throw AppError.conflict('ORDER_IN_OTHER_ACCOUNT', 'Este pedido já está em outra conta.');
    }

    if (found.customerUserId === null) {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: found.id, customerUserId: null },
          data: { customerUserId: principal.userId }
        });

        if (claimed.count === 1) {
          await this.audit.record(
            {
              actorUserId: principal.userId,
              action: 'order.linked_to_account',
              entityType: 'Order',
              entityId: found.id,
              after: { via: 'numero-e-codigo' },
              meta
            },
            tx
          );
        }
      });
    }

    return this.reader.getOwn(principal.userId, found.id);
  }

  /**
   * "Esqueci o código" (DT-096): reenvia o acesso (número, código e link fixo) dos pedidos sem
   * conta deste e-mail nos últimos 12 meses, até 10, pela fila de avisos. Não revela se o
   * e-mail comprou: quem chama recebe sempre a mesma resposta. Um reenvio por pedido por dia.
   */
  async resendGuestAccess(emailInput: string, meta: RequestMeta): Promise<void> {
    const email = normalizeEmail(emailInput);
    const orders = await this.prisma.order.findMany({
      where: {
        customerUserId: null,
        customerEmail: { equals: email, mode: 'insensitive' },
        guestAccessTokenHash: { not: null },
        createdAt: { gte: new Date(Date.now() - 365 * 86_400_000) }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        customerUserId: true,
        customerEmail: true,
        customerPhone: true,
        guestWhatsappOptInAt: true,
        guestAccessCodeEncrypted: true
      }
    });
    const day = new Date().toISOString().slice(0, 10);

    for (const order of orders) {
      let code = order.guestAccessCodeEncrypted
        ? decryptField(order.guestAccessCodeEncrypted, this.config.values.dataEncryptionKey)
        : null;

      // Pedido de antes do código guardado: recebe um código novo (o antigo deixa de valer).
      if (code === null) {
        code = generateGuestCode();
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            guestAccessTokenHash: guestCodeHash(code),
            guestAccessCodeEncrypted: encryptField(code, this.config.values.dataEncryptionKey)
          }
        });
      }

      await this.guestMessages.enqueue(
        this.prisma,
        order,
        `resend:${day}`,
        `Acesso ao pedido ${order.orderNumber}`,
        `Você pediu o acesso ao seu pedido. Número: ${order.orderNumber}. Código de acesso: ${formatGuestCode(code)}.`
      );
      await this.audit.record({
        actorUserId: null,
        action: 'order.guest_access.resent',
        entityType: 'Order',
        entityId: order.id,
        meta
      });
    }
  }

  /**
   * Quem comprou sem conta liga ou desliga os avisos do pedido por WhatsApp (DT-096, DT-048:
   * consentimento registrado e revogável). Desligar cancela os avisos ainda na fila.
   */
  async setGuestWhatsapp(
    orderNumber: string,
    code: string,
    enabled: boolean,
    meta: RequestMeta
  ): Promise<OrderView> {
    const found = await this.prisma.order.findFirst({
      where: {
        orderNumber: orderNumber.trim().toUpperCase(),
        guestAccessTokenHash: guestCodeHash(code)
      },
      select: { id: true, customerPhone: true, guestWhatsappOptInAt: true }
    });

    if (found === null) {
      throw AppError.notFound('Pedido não encontrado. Confira o número e o código.');
    }

    if (enabled && !whatsappNumber(found.customerPhone)) {
      throw AppError.validation(
        'PHONE_REQUIRED',
        'O pedido não tem um celular válido para receber avisos por WhatsApp.'
      );
    }

    if (enabled !== (found.guestWhatsappOptInAt !== null)) {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: found.id },
          data: { guestWhatsappOptInAt: enabled ? new Date() : null }
        });

        if (!enabled) {
          await tx.guestOrderMessage.updateMany({
            where: { orderId: found.id, channel: 'WHATSAPP', status: 'PENDING' },
            data: { status: 'CANCELLED', failureCode: 'CONSENTIMENTO_RETIRADO' }
          });
        }

        await this.audit.record(
          {
            actorUserId: null,
            action: enabled ? 'order.guest_whatsapp.opt_in' : 'order.guest_whatsapp.opt_out',
            entityType: 'Order',
            entityId: found.id,
            before: { whatsapp: !enabled },
            after: { whatsapp: enabled },
            meta
          },
          tx
        );
      });
    }

    return this.guestLookup(orderNumber, code);
  }
}
