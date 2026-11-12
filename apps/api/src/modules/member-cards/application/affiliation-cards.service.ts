import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { AuditService } from '../../../common/audit/audit.service';
import { civilToDate, optionalCivil, todayIn } from '../../../common/domain/civil-date';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { addMonths, newCardCode, renewedPeriod } from '../domain/card-rules';

/**
 * Afiliação vendida pela loja (DT-069): ativa as carteirinhas no pagamento, cancela no estorno,
 * avisa o titular e a validade perto do fim e divulga a afiliação.
 */
@Injectable()
export class AffiliationCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService
  ) {}

  /**
   * Pedido pago: cria uma carteirinha de afiliado por beneficiário, ou soma o período à
   * carteirinha renovada. Roda uma vez por item (marca `activatedAt` nos detalhes).
   */
  async activateAffiliationsInTx(tx: PrismaTx, orderId: string): Promise<number> {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        customerUserId: true,
        orderNumber: true,
        items: {
          where: { product: { fulfillmentType: 'MEMBERSHIP' } },
          select: { id: true, details: true, product: { select: { membershipMonths: true } } }
        }
      }
    });
    const today = todayIn();
    let activated = 0;

    for (const item of order.items) {
      const details = (item.details ?? {}) as {
        beneficiaries?: { name: string; email: string | null; cardId: string | null }[];
        activatedAt?: string;
      };

      if (details.activatedAt || !details.beneficiaries) {
        continue;
      }

      const months = item.product.membershipMonths ?? 12;
      const applied: Record<string, unknown>[] = [];

      for (const beneficiary of details.beneficiaries) {
        const renewing = beneficiary.cardId
          ? await tx.memberCard.findFirst({
              where: {
                id: beneficiary.cardId,
                type: 'AFFILIATE',
                deletedAt: null,
                status: { not: 'CANCELLED' }
              }
            })
          : null;

        if (renewing) {
          const period = renewedPeriod(optionalCivil(renewing.endsOn), today, months);

          await tx.memberCard.update({
            where: { id: renewing.id },
            data: { endsOn: civilToDate(period.endsOn) }
          });
          applied.push({
            cardId: renewing.id,
            renewed: true,
            previousEndsOn: optionalCivil(renewing.endsOn),
            endsOn: period.endsOn
          });
          await this.notifyHolder(tx, renewing.holderUserId ?? renewing.purchasedByUserId, {
            id: renewing.id,
            title: 'Afiliação renovada',
            message: `A carteirinha de ${renewing.holderName} vale até ${period.endsOn.split('-').reverse().join('/')}.`
          });
        } else {
          const holder = beneficiary.email
            ? await tx.user.findFirst({
                where: {
                  email: { equals: beneficiary.email, mode: 'insensitive' },
                  emailVerifiedAt: { not: null },
                  deletedAt: null
                },
                select: { id: true }
              })
            : null;
          const card = await tx.memberCard.create({
            data: {
              code: await this.freeCode(tx),
              type: 'AFFILIATE',
              holderName: beneficiary.name,
              holderEmail: beneficiary.email,
              holderUserId: holder?.id ?? null,
              purchasedByUserId: order.customerUserId,
              orderItemId: item.id,
              startsOn: civilToDate(today),
              endsOn: civilToDate(addMonths(today, months))
            }
          });

          applied.push({ cardId: card.id, renewed: false });
          await this.notifyHolder(tx, holder?.id ?? order.customerUserId, {
            id: card.id,
            title: 'Carteirinha de afiliado ativa',
            message: `A carteirinha de ${card.holderName} já vale. Veja em Minha conta → Carteirinhas.`
          });
        }

        activated += 1;
      }

      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          details: {
            ...(details as Record<string, unknown>),
            activatedAt: new Date().toISOString(),
            applied
          } as Prisma.InputJsonObject
        }
      });
    }

    return activated;
  }

  /**
   * Pedido cancelado ou estornado: carteirinhas criadas por ele são canceladas e a
   * renovação volta à data anterior (se ninguém mexeu depois).
   */
  async cancelAffiliationsInTx(tx: PrismaTx, orderId: string, reason: string): Promise<number> {
    const items = await tx.orderItem.findMany({
      where: { orderId, product: { fulfillmentType: 'MEMBERSHIP' } },
      select: { id: true, details: true }
    });
    let changed = 0;

    for (const item of items) {
      const applied =
        (
          (item.details ?? {}) as {
            applied?: {
              cardId: string;
              renewed: boolean;
              previousEndsOn?: string | null;
              endsOn?: string;
            }[];
          }
        ).applied ?? [];

      for (const entry of applied) {
        if (entry.renewed) {
          const card = await tx.memberCard.findUnique({ where: { id: entry.cardId } });

          if (card && optionalCivil(card.endsOn) === entry.endsOn) {
            await tx.memberCard.update({
              where: { id: card.id },
              data: { endsOn: entry.previousEndsOn ? civilToDate(entry.previousEndsOn) : null }
            });
            changed += 1;
          }
        } else {
          const { count } = await tx.memberCard.updateMany({
            where: { id: entry.cardId, status: { not: 'CANCELLED' } },
            data: { status: 'CANCELLED', statusReason: reason }
          });

          changed += count;
        }
      }
    }

    return changed;
  }

  /** Desistência de uma afiliação (DT-070): as carteirinhas daquele item são canceladas. */
  async cancelByOrderItemInTx(tx: PrismaTx, orderItemId: string, reason: string): Promise<number> {
    const { count } = await tx.memberCard.updateMany({
      where: { orderItemId, status: { not: 'CANCELLED' } },
      data: { status: 'CANCELLED', statusReason: reason }
    });

    return count;
  }

  private async freeCode(tx: PrismaTx): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = newCardCode();

      if ((await tx.memberCard.count({ where: { code } })) === 0) {
        return code;
      }
    }

    throw AppError.conflict('CODE_UNAVAILABLE', 'Não foi possível gerar o número da carteirinha.');
  }

  private async notifyHolder(
    tx: PrismaTx,
    userId: string | null,
    input: { id: string; title: string; message: string }
  ): Promise<void> {
    if (!userId) {
      return;
    }

    await this.notifications.notify(
      {
        userId,
        type: 'card.affiliation',
        title: input.title,
        message: input.message,
        link: '/minha-conta/carteirinhas',
        deduplicationKey: `card-affiliation:${input.id}:${input.title}`
      },
      tx
    );
  }

  /** Aviso 15 dias antes de a afiliação vencer, uma vez por data final. */
  async noticeExpiring(now: Date = new Date()): Promise<number> {
    const target = todayIn(undefined, now);
    const in15 = new Date(civilToDate(target).getTime() + 15 * 86_400_000);
    const cards = await this.prisma.memberCard.findMany({
      where: {
        type: 'AFFILIATE',
        status: 'ACTIVE',
        deletedAt: null,
        endsOn: { gte: civilToDate(target), lte: in15 }
      },
      select: {
        id: true,
        holderName: true,
        endsOn: true,
        holderUserId: true,
        purchasedByUserId: true
      }
    });
    let sent = 0;

    for (const card of cards) {
      const userId = card.holderUserId ?? card.purchasedByUserId;
      const endsOn = optionalCivil(card.endsOn) ?? '';

      if (userId) {
        sent += await this.notifications.notify({
          userId,
          type: 'card.expiring',
          title: 'Afiliação perto de vencer',
          message: `A carteirinha de ${card.holderName} vence em ${endsOn.split('-').reverse().join('/')}. Renove na loja para não perder os benefícios.`,
          link: '/minha-conta/carteirinhas',
          deduplicationKey: `card-expiring:${card.id}:${endsOn}`
        });
      }
    }

    return sent;
  }

  /** Avisa todas as contas ativas que a afiliação está à venda, uma vez por produto. */
  async announceMembership(
    actor: Principal,
    productId: string,
    meta: RequestMeta
  ): Promise<{ notified: number }> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null, fulfillmentType: 'MEMBERSHIP' },
      select: { id: true, name: true, slug: true, status: true, membershipMonths: true }
    });

    if (product === null) {
      throw AppError.notFound('Afiliação não encontrada.');
    }

    if (product.status !== 'ACTIVE') {
      throw AppError.conflict('NOT_ACTIVE', 'Publique a afiliação antes de avisar.');
    }

    const claimed = await this.prisma.product.updateMany({
      where: { id: productId, membershipAnnouncedAt: null },
      data: { membershipAnnouncedAt: new Date() }
    });

    if (claimed.count === 0) {
      throw AppError.conflict('ALREADY_ANNOUNCED', 'O aviso desta afiliação já foi enviado.');
    }

    let cursor: string | undefined;
    let notified = 0;

    for (;;) {
      const users = await this.prisma.user.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
      });

      if (users.length === 0) {
        break;
      }

      notified += await this.notifications.notify(
        users.map((user) => ({
          userId: user.id,
          type: 'announcement.membership',
          title: 'Afiliações abertas',
          message: `${product.name}: carteirinha de afiliado com descontos em parceiros${product.membershipMonths ? `, válida por ${product.membershipMonths} meses` : ''}.`,
          link: `/loja/${product.slug}`,
          deduplicationKey: `membership-open:${product.id}:${user.id}`
        }))
      );
      cursor = users[users.length - 1]?.id;
    }

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'cards.membership.announced',
      entityType: 'Product',
      entityId: productId,
      after: { notified },
      meta
    });

    return { notified };
  }
}
