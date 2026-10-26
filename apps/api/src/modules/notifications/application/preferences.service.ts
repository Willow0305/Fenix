import { Injectable } from '@nestjs/common';
import type { NotificationCategory } from '@prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { AppConfig } from '../../../common/config/app-config';
import { AppError } from '../../../common/errors/app-error';
import type { RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type ExternalChannel,
  preferenceEnabled,
  whatsappNumber
} from '../domain/channel-rules';
import { DeliveryService, recipientPhone } from './delivery.service';

export interface CategoryPreferenceView {
  readonly category: NotificationCategory;
  readonly label: string;
  readonly email: boolean;
  readonly whatsapp: boolean;
}

export interface PreferencesView {
  readonly email: string;
  readonly whatsapp: {
    /** Canal ligado no servidor. */
    readonly available: boolean;
    /** Mensagens gravadas em arquivo, sem envio real. */
    readonly testMode: boolean;
    readonly consentedAt: string | null;
    /** Celular válido no cadastro (só dígitos), ou nulo. */
    readonly phone: string | null;
  };
  readonly categories: CategoryPreferenceView[];
}

export interface PreferenceChange {
  readonly category: NotificationCategory;
  readonly channel: ExternalChannel;
  readonly enabled: boolean;
}

/** Escolha de canais por finalidade e consentimento para WhatsApp (PEN-040, DT-048). */
@Injectable()
export class PreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
    private readonly delivery: DeliveryService
  ) {}

  async get(userId: string): Promise<PreferencesView> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        phone: true,
        whatsappOptInAt: true,
        athlete: { select: { phone: true } },
        notificationPreferences: { select: { category: true, channel: true, enabled: true } }
      }
    });
    const phone = whatsappNumber(recipientPhone(user));

    return {
      email: user.email,
      whatsapp: {
        available: this.delivery.availableChannels().has('WHATSAPP'),
        testMode: this.config.values.whatsappDriver === 'outbox',
        consentedAt: user.whatsappOptInAt?.toISOString() ?? null,
        phone: phone ? phone.slice(2) : null
      },
      categories: CATEGORIES.map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        email: preferenceEnabled(user.notificationPreferences, category, 'EMAIL'),
        whatsapp: preferenceEnabled(user.notificationPreferences, category, 'WHATSAPP')
      }))
    };
  }

  async update(userId: string, changes: readonly PreferenceChange[]): Promise<PreferencesView> {
    await this.prisma.$transaction(
      changes.map((change) =>
        this.prisma.notificationPreference.upsert({
          where: {
            userId_category_channel: {
              userId,
              category: change.category,
              channel: change.channel
            }
          },
          create: { userId, ...change },
          update: { enabled: change.enabled }
        })
      )
    );

    return this.get(userId);
  }

  /**
   * Aceite ou retirada do consentimento para WhatsApp. O aceite exige celular válido no
   * cadastro; a retirada cancela o que ainda estava na fila. Ambos ficam na auditoria.
   */
  async setWhatsAppConsent(
    userId: string,
    accept: boolean,
    meta: RequestMeta
  ): Promise<PreferencesView> {
    const current = await this.get(userId);

    if (accept && !current.whatsapp.available) {
      throw AppError.conflict('WHATSAPP_UNAVAILABLE', 'Os avisos por WhatsApp não estão ativos.');
    }

    if (accept && !current.whatsapp.phone) {
      throw AppError.validation(
        'MOBILE_REQUIRED',
        'Cadastre um celular com DDD em Meus dados para receber avisos por WhatsApp.'
      );
    }

    if (accept === (current.whatsapp.consentedAt !== null)) {
      return current;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { whatsappOptInAt: accept ? new Date() : null }
      });

      if (!accept) {
        await tx.notificationDelivery.updateMany({
          where: { channel: 'WHATSAPP', status: 'PENDING', notification: { userId } },
          data: { status: 'CANCELLED', failureCode: 'SEM_CONSENTIMENTO' }
        });
      }

      await this.audit.record(
        {
          actorUserId: userId,
          action: accept
            ? 'notifications.whatsapp_consent.granted'
            : 'notifications.whatsapp_consent.revoked',
          entityType: 'User',
          entityId: userId,
          before: { whatsappOptIn: !accept },
          after: { whatsappOptIn: accept },
          meta
        },
        tx
      );
    });

    return this.get(userId);
  }
}
