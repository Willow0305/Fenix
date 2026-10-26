import { Injectable } from '@nestjs/common';
import type { AppointmentStatus, Prisma } from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { todayIn } from '../../../common/domain/civil-date';
import { DEFAULT_CURRENCY, type MoneyView, moneyView } from '../../../common/domain/money';
import { assertTransition } from '../../../common/domain/state-machine';
import { endOfDayExclusive, startOfDayInZone } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { MailSender } from '../../../common/mail/mail.service';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { lockRow } from '../../finance/application/ledger.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TRANSITIONS,
  fitsDuration,
  operationalPartnerWhere,
  overlaps
} from '../domain/partner-rules';

export interface AppointmentView {
  readonly id: string;
  readonly status: AppointmentStatus;
  readonly service: { id: string; name: string; durationMinutes: number };
  readonly partner: { id: string; name: string };
  readonly professional: { id: string; fullName: string } | null;
  readonly requester: { id: string; name: string; email?: string; phone?: string | null };
  readonly scheduledStartsAt: string | null;
  readonly scheduledEndsAt: string | null;
  readonly quotedPrice: MoneyView | null;
  readonly requesterNotes: string | null;
  /** Somente para a diretoria. */
  readonly administrativeNotes?: string | null;
  readonly confirmedAt: string | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
  readonly createdAt: string;
}

export interface AppointmentFilters extends PageQueryDto {
  readonly status?: AppointmentStatus;
  readonly partnerId?: string;
  readonly professionalId?: string;
  readonly from?: string;
  readonly to?: string;
}

const APPOINTMENT_INCLUDE = {
  partnerService: {
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      partner: { select: { id: true, displayName: true } }
    }
  },
  professional: { select: { id: true, fullName: true, email: true } },
  requesterUser: { select: { id: true, name: true, email: true, phone: true } }
} satisfies Prisma.AppointmentInclude;

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof APPOINTMENT_INCLUDE }>;

/** Aviso exibido no formulário e repetido na API: nenhum dado de saúde (RN-PAR-008). */
export const HEALTH_DATA_NOTICE =
  'Não informe sintomas, diagnósticos, exames ou qualquer dado de saúde. Use este campo apenas para preferências de contato.';

function formatInstant(value: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Rio_Branco',
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(value);
}

/**
 * Agendamento manual (RF-034, PEN-037, DT-033): usuário solicita um horário livre, a
 * diretoria confirma ou cancela. O horário fica reservado durante a solicitação, e
 * nunca há dois atendimentos confirmados sobrepostos para o mesmo profissional.
 */
@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailSender
  ) {}

  private toView(row: AppointmentRow, staff: boolean): AppointmentView {
    return {
      id: row.id,
      status: row.status,
      service: {
        id: row.partnerService.id,
        name: row.partnerService.name,
        durationMinutes: row.partnerService.durationMinutes
      },
      partner: {
        id: row.partnerService.partner.id,
        name: row.partnerService.partner.displayName
      },
      professional: row.professional
        ? { id: row.professional.id, fullName: row.professional.fullName }
        : null,
      requester: staff
        ? {
            id: row.requesterUser.id,
            name: row.requesterUser.name,
            email: row.requesterUser.email,
            phone: row.requesterUser.phone
          }
        : { id: row.requesterUser.id, name: row.requesterUser.name },
      scheduledStartsAt: row.scheduledStartsAt?.toISOString() ?? null,
      scheduledEndsAt: row.scheduledEndsAt?.toISOString() ?? null,
      quotedPrice: row.quotedPrice
        ? moneyView(row.quotedPrice, row.currency ?? DEFAULT_CURRENCY)
        : null,
      requesterNotes: row.requesterNotes,
      ...(staff ? { administrativeNotes: row.administrativeNotes } : {}),
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      cancellationReason: row.cancellationReason,
      createdAt: row.createdAt.toISOString()
    };
  }

  private async load(tx: PrismaTx, id: string): Promise<AppointmentRow> {
    const row = await tx.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE });

    if (row === null) {
      throw AppError.notFound('Agendamento não encontrado.');
    }

    return row;
  }

  async get(id: string): Promise<AppointmentView> {
    return this.toView(await this.load(this.prisma, id), true);
  }

  async list(filters: AppointmentFilters): Promise<Page<AppointmentView>> {
    const { skip, take, page, pageSize } = pageArgs(filters);
    const where: Prisma.AppointmentWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.professionalId ? { professionalId: filters.professionalId } : {}),
      ...(filters.partnerId ? { partnerService: { partnerId: filters.partnerId } } : {}),
      ...(filters.from || filters.to
        ? {
            scheduledStartsAt: {
              ...(filters.from ? { gte: startOfDayInZone(filters.from) } : {}),
              ...(filters.to ? { lt: endOfDayExclusive(filters.to) } : {})
            }
          }
        : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        include: APPOINTMENT_INCLUDE,
        orderBy: [{ scheduledStartsAt: 'asc' }, { createdAt: 'asc' }],
        skip,
        take
      }),
      this.prisma.appointment.count({ where })
    ]);

    return toPage(
      rows.map((row) => this.toView(row, true)),
      total,
      page,
      pageSize
    );
  }

  async mine(userId: string): Promise<AppointmentView[]> {
    const rows = await this.prisma.appointment.findMany({
      where: { requesterUserId: userId },
      include: APPOINTMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return rows.map((row) => this.toView(row, false));
  }

  /** Solicitação pelo usuário autenticado em um horário livre do serviço. */
  async request(
    principal: Principal,
    input: { serviceId: string; availabilityId: string; notes?: string },
    meta: RequestMeta
  ): Promise<AppointmentView> {
    const now = new Date();
    const id = await this.prisma.$transaction(async (tx) => {
      const service = await tx.partnerService.findFirst({
        where: {
          id: input.serviceId,
          deletedAt: null,
          status: 'ACTIVE',
          partner: operationalPartnerWhere(todayIn())
        },
        include: { partner: { select: { displayName: true } } }
      });

      if (service === null) {
        throw AppError.notFound('Serviço não encontrado.');
      }

      await lockRow(tx, 'availability', input.availabilityId);
      const slot = await tx.professionalAvailability.findUnique({
        where: { id: input.availabilityId },
        include: { professional: true }
      });

      if (
        slot === null ||
        slot.professional.partnerId !== service.partnerId ||
        slot.professional.deletedAt !== null ||
        slot.professional.status !== 'ACTIVE' ||
        (service.professionalId !== null && slot.professionalId !== service.professionalId) ||
        (slot.partnerServiceId !== null && slot.partnerServiceId !== service.id)
      ) {
        throw AppError.notFound('Horário não encontrado para este serviço.');
      }

      if (slot.status !== 'AVAILABLE' || slot.startsAt <= now) {
        throw AppError.conflict(
          'SLOT_UNAVAILABLE',
          'Este horário não está mais disponível. Escolha outro.'
        );
      }

      if (!fitsDuration(slot, service.durationMinutes)) {
        throw AppError.conflict('SLOT_TOO_SHORT', 'O horário não comporta a duração do serviço.');
      }

      const pending = await tx.appointment.count({
        where: { requesterUserId: principal.userId, status: 'REQUESTED' }
      });

      if (pending >= 5) {
        throw AppError.conflict(
          'TOO_MANY_REQUESTS_PENDING',
          'Você já tem 5 solicitações aguardando confirmação.'
        );
      }

      const endsAt = new Date(slot.startsAt.getTime() + service.durationMinutes * 60_000);

      await tx.professionalAvailability.update({
        where: { id: slot.id },
        data: { status: 'RESERVED' }
      });

      const created = await tx.appointment.create({
        data: {
          partnerServiceId: service.id,
          professionalId: slot.professionalId,
          availabilityId: slot.id,
          requesterUserId: principal.userId,
          requestedStartsAt: slot.startsAt,
          requestedEndsAt: endsAt,
          scheduledStartsAt: slot.startsAt,
          scheduledEndsAt: endsAt,
          quotedPrice: service.price,
          currency: service.price ? (service.currency ?? DEFAULT_CURRENCY) : null,
          requesterNotes: input.notes?.trim() || null
        }
      });

      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'appointment.requested',
          entityType: 'Appointment',
          entityId: created.id,
          after: { serviceId: service.id, startsAt: slot.startsAt.toISOString() },
          meta
        },
        tx
      );

      const staff = await this.notifications.permissionHolders(PERMISSIONS.appointmentsManage, tx);

      await this.notifications.notify(
        staff.map((userId) => ({
          userId,
          type: 'appointment.requested',
          title: 'Nova solicitação de atendimento',
          message: `${service.name} (${service.partner.displayName}) em ${formatInstant(slot.startsAt)}.`,
          link: '/admin/agendamentos',
          deduplicationKey: `appointment-requested:${created.id}:${userId}`
        })),
        tx
      );

      return created.id;
    });

    return this.toView(await this.load(this.prisma, id), false);
  }

  /** Libera o horário reservado para nova solicitação (sem apagar o agendamento). */
  private async releaseSlot(tx: PrismaTx, row: AppointmentRow): Promise<void> {
    if (row.availabilityId) {
      await tx.appointment.update({ where: { id: row.id }, data: { availabilityId: null } });
      await tx.professionalAvailability.updateMany({
        where: { id: row.availabilityId, status: 'RESERVED' },
        data: { status: 'AVAILABLE' }
      });
    }
  }

  private async notifyParties(row: AppointmentRow, status: AppointmentStatus, reason?: string) {
    const when = row.scheduledStartsAt ? formatInstant(row.scheduledStartsAt) : '';
    const label = APPOINTMENT_STATUS_LABELS[status];

    await this.notifications.notify({
      userId: row.requesterUserId,
      type: 'appointment.status',
      title: `Atendimento ${label.toLowerCase()}`,
      message: `${row.partnerService.name} em ${when}: ${label}.${reason ? ` Motivo: ${reason}` : ''}`,
      link: '/minha-conta/agendamentos',
      deduplicationKey: `appointment-status:${row.id}:${status}`
    });

    // Parceiro não tem login nesta fase (PEN-036): o profissional recebe e-mail mínimo.
    if (row.professional?.email && (status === 'CONFIRMED' || status === 'CANCELLED')) {
      await this.mail
        .send({
          to: row.professional.email,
          subject: `Atendimento ${label.toLowerCase()} — Fênix Vôlei`,
          text: [
            `Olá, ${row.professional.fullName}.`,
            '',
            `Atendimento "${row.partnerService.name}" em ${when}: ${label}.`,
            `Solicitante: ${row.requesterUser.name}.`,
            ...(reason ? [`Motivo: ${reason}`] : []),
            '',
            'Dúvidas: fale com a diretoria do Fênix Vôlei.'
          ].join('\n')
        })
        .catch(() => undefined);
    }
  }

  /** Diretoria confirma, cancela, registra realização ou ausência (RN-PAR-006). */
  async changeStatus(
    actor: Principal,
    id: string,
    status: AppointmentStatus,
    input: { reason?: string; administrativeNotes?: string },
    meta: RequestMeta
  ): Promise<AppointmentView> {
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'appointment', id);
      const current = await this.load(tx, id);

      assertTransition(APPOINTMENT_TRANSITIONS, current.status, status, APPOINTMENT_STATUS_LABELS);

      if (status === 'CANCELLED' && !input.reason) {
        throw AppError.validation('REASON_REQUIRED', 'Informe o motivo do cancelamento.');
      }

      if (
        (status === 'COMPLETED' || status === 'NO_SHOW') &&
        current.scheduledStartsAt !== null &&
        current.scheduledStartsAt > now
      ) {
        throw AppError.conflict(
          'NOT_STARTED',
          'Só é possível registrar realização ou ausência após o horário marcado.'
        );
      }

      if (status === 'CONFIRMED') {
        if (current.scheduledStartsAt === null || current.scheduledEndsAt === null) {
          throw AppError.conflict('NO_SCHEDULE', 'Agendamento sem horário definido.');
        }

        if (current.professionalId) {
          await lockRow(tx, 'professional', current.professionalId);
          const confirmed = await tx.appointment.findMany({
            where: {
              id: { not: id },
              professionalId: current.professionalId,
              status: 'CONFIRMED',
              scheduledStartsAt: { lt: current.scheduledEndsAt },
              scheduledEndsAt: { gt: current.scheduledStartsAt }
            },
            select: { scheduledStartsAt: true, scheduledEndsAt: true }
          });
          const interval = {
            startsAt: current.scheduledStartsAt,
            endsAt: current.scheduledEndsAt
          };

          if (
            confirmed.some(
              (other) =>
                other.scheduledStartsAt !== null &&
                other.scheduledEndsAt !== null &&
                overlaps(
                  { startsAt: other.scheduledStartsAt, endsAt: other.scheduledEndsAt },
                  interval
                )
            )
          ) {
            throw AppError.conflict(
              'SCHEDULE_CONFLICT',
              'O profissional já tem atendimento confirmado neste horário.'
            );
          }
        }
      }

      if (status === 'CANCELLED') {
        await this.releaseSlot(tx, current);
      }

      await tx.appointment.update({
        where: { id },
        data: {
          status,
          ...(input.administrativeNotes === undefined
            ? {}
            : { administrativeNotes: input.administrativeNotes }),
          ...(status === 'CONFIRMED' ? { confirmedAt: now } : {}),
          ...(status === 'CANCELLED'
            ? { cancelledAt: now, cancellationReason: input.reason ?? null }
            : {})
        }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'appointment.status.changed',
          entityType: 'Appointment',
          entityId: id,
          reason: input.reason ?? null,
          before: { status: current.status },
          after: { status },
          meta
        },
        tx
      );

      return current;
    });

    await this.notifyParties(row, status, input.reason);

    return this.get(id);
  }

  /** O próprio solicitante cancela antes do horário, com motivo. */
  async cancelOwn(
    principal: Principal,
    id: string,
    reason: string,
    meta: RequestMeta
  ): Promise<AppointmentView> {
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'appointment', id);
      const current = await this.load(tx, id);

      if (current.requesterUserId !== principal.userId) {
        throw AppError.notFound('Agendamento não encontrado.');
      }

      assertTransition(
        APPOINTMENT_TRANSITIONS,
        current.status,
        'CANCELLED',
        APPOINTMENT_STATUS_LABELS
      );

      if (current.scheduledStartsAt !== null && current.scheduledStartsAt <= now) {
        throw AppError.conflict('ALREADY_STARTED', 'O horário já passou. Fale com a diretoria.');
      }

      await this.releaseSlot(tx, current);
      await tx.appointment.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancellationReason: `Cancelado pelo solicitante: ${reason}`
        }
      });
      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'appointment.cancelled_by_requester',
          entityType: 'Appointment',
          entityId: id,
          reason,
          before: { status: current.status },
          after: { status: 'CANCELLED' },
          meta
        },
        tx
      );

      return current;
    });
    const staff = await this.notifications.permissionHolders(PERMISSIONS.appointmentsManage);

    await this.notifications.notify(
      staff.map((userId) => ({
        userId,
        type: 'appointment.cancelled',
        title: 'Solicitação cancelada pelo usuário',
        message: `${row.partnerService.name} — ${row.requesterUser.name}.`,
        link: '/admin/agendamentos',
        deduplicationKey: `appointment-cancelled-own:${id}:${userId}`
      }))
    );

    if (row.status === 'CONFIRMED') {
      await this.notifyParties({ ...row, status: 'CANCELLED' }, 'CANCELLED', reason);
    }

    return this.toView(await this.load(this.prisma, id), false);
  }
}
