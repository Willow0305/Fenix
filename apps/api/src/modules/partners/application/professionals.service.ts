import { Injectable } from '@nestjs/common';
import type { AvailabilityStatus, ProfessionalStatus, Prisma, ServiceStatus } from '@prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { AppConfig } from '../../../common/config/app-config';
import { encryptField } from '../../../common/crypto/data-cipher';
import { sha256Hex } from '../../../common/crypto/tokens';
import { todayIn } from '../../../common/domain/civil-date';
import {
  DEFAULT_CURRENCY,
  type Money,
  type MoneyView,
  moneyView
} from '../../../common/domain/money';
import { assertTransition } from '../../../common/domain/state-machine';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { lockRow } from '../../finance/application/ledger.service';
import { normalizeDocument } from '../../sports/domain/sports-rules';
import {
  fitsDuration,
  invalidInterval,
  operationalPartnerWhere,
  overlaps,
  SERVICE_TRANSITIONS
} from '../domain/partner-rules';

export interface ProfessionalView {
  readonly id: string;
  readonly partner: { id: string; name: string };
  readonly fullName: string;
  readonly profession: string;
  readonly hasLicense: boolean;
  readonly email: string | null;
  readonly phone: string | null;
  readonly publicBio: string | null;
  readonly publicContact: boolean;
  readonly status: ProfessionalStatus;
}

export interface ServiceView {
  readonly id: string;
  readonly partner: { id: string; name: string };
  readonly professional: { id: string; fullName: string } | null;
  readonly name: string;
  readonly description: string | null;
  readonly durationMinutes: number;
  readonly price: MoneyView | null;
  readonly status: ServiceStatus;
}

export interface AvailabilityView {
  readonly id: string;
  readonly professionalId: string;
  readonly serviceId: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: AvailabilityStatus;
  readonly notes: string | null;
  readonly appointmentId: string | null;
}

export interface ProfessionalInput {
  readonly fullName: string;
  readonly profession: string;
  readonly licenseNumber?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly publicBio?: string | null;
  readonly publicContact?: boolean;
}

export interface ServiceInput {
  readonly name: string;
  readonly description?: string | null;
  readonly durationMinutes: number;
  readonly price?: Money | null;
  readonly professionalId?: string | null;
}

const PROFESSIONAL_INCLUDE = {
  partner: { select: { id: true, displayName: true } }
} satisfies Prisma.PartnerProfessionalInclude;

const SERVICE_INCLUDE = {
  partner: { select: { id: true, displayName: true } },
  professional: { select: { id: true, fullName: true } }
} satisfies Prisma.PartnerServiceInclude;

type ProfessionalRow = Prisma.PartnerProfessionalGetPayload<{
  include: typeof PROFESSIONAL_INCLUDE;
}>;
type ServiceRow = Prisma.PartnerServiceGetPayload<{ include: typeof SERVICE_INCLUDE }>;

/** Profissionais, serviços e disponibilidade (RF-033, RCF-011, RN-PAR-005/008). */
@Injectable()
export class ProfessionalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: AppConfig
  ) {}

  private professionalView(row: ProfessionalRow): ProfessionalView {
    return {
      id: row.id,
      partner: { id: row.partner.id, name: row.partner.displayName },
      fullName: row.fullName,
      profession: row.profession,
      hasLicense: row.licenseNumberEncrypted !== null,
      email: row.email,
      phone: row.phone,
      publicBio: row.publicBio,
      publicContact: row.publicContact,
      status: row.status
    };
  }

  private serviceView(row: ServiceRow): ServiceView {
    return {
      id: row.id,
      partner: { id: row.partner.id, name: row.partner.displayName },
      professional: row.professional,
      name: row.name,
      description: row.description,
      durationMinutes: row.durationMinutes,
      price: row.price ? moneyView(row.price, row.currency ?? DEFAULT_CURRENCY) : null,
      status: row.status
    };
  }

  private availabilityView(
    row: Prisma.ProfessionalAvailabilityGetPayload<{
      include: { appointment: { select: { id: true } } };
    }>
  ): AvailabilityView {
    return {
      id: row.id,
      professionalId: row.professionalId,
      serviceId: row.partnerServiceId,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      status: row.status,
      notes: row.notes,
      appointmentId: row.appointment?.id ?? null
    };
  }

  // ---------- Profissionais ----------

  async listProfessionals(partnerId?: string): Promise<ProfessionalView[]> {
    const rows = await this.prisma.partnerProfessional.findMany({
      where: { deletedAt: null, ...(partnerId ? { partnerId } : {}) },
      include: PROFESSIONAL_INCLUDE,
      orderBy: { fullName: 'asc' }
    });

    return rows.map((row) => this.professionalView(row));
  }

  async getProfessional(id: string): Promise<ProfessionalView> {
    const row = await this.prisma.partnerProfessional.findFirst({
      where: { id, deletedAt: null },
      include: PROFESSIONAL_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Profissional não encontrado.');
    }

    return this.professionalView(row);
  }

  private licenseFields(
    partnerId: string,
    license: string | null | undefined
  ): { licenseNumberEncrypted?: string | null; licenseNumberHash?: string | null } {
    if (license === undefined) {
      return {};
    }

    const normalized = license ? normalizeDocument(license) : '';

    return normalized
      ? {
          licenseNumberEncrypted: encryptField(normalized, this.config.values.dataEncryptionKey),
          licenseNumberHash: sha256Hex(`professional-license:${partnerId}:${normalized}`)
        }
      : { licenseNumberEncrypted: null, licenseNumberHash: null };
  }

  /** RN-PAR-005: profissional só é vinculado a parceiro aprovado (ativo). */
  async createProfessional(
    actor: Principal,
    partnerId: string,
    input: ProfessionalInput,
    meta: RequestMeta
  ): Promise<ProfessionalView> {
    const partner = await this.prisma.partner.findFirst({
      where: { id: partnerId, deletedAt: null },
      select: { status: true }
    });

    if (partner === null) {
      throw AppError.notFound('Parceiro não encontrado.');
    }

    if (partner.status !== 'ACTIVE') {
      throw AppError.conflict(
        'PARTNER_NOT_APPROVED',
        'Aprove o parceiro antes de cadastrar profissionais.'
      );
    }

    const license = this.licenseFields(partnerId, input.licenseNumber);

    if (license.licenseNumberHash) {
      const duplicate = await this.prisma.partnerProfessional.findFirst({
        where: { partnerId, licenseNumberHash: license.licenseNumberHash },
        select: { id: true }
      });

      if (duplicate) {
        throw AppError.conflict(
          'DUPLICATE_LICENSE',
          'Já existe profissional deste parceiro com este registro.'
        );
      }
    }

    const id = await this.prisma.$transaction(async (tx) => {
      const created = await tx.partnerProfessional.create({
        data: {
          partnerId,
          fullName: input.fullName.trim(),
          profession: input.profession.trim(),
          ...license,
          email: input.email?.trim().toLowerCase() || null,
          phone: input.phone ?? null,
          publicBio: input.publicBio ?? null,
          publicContact: input.publicContact ?? false
        }
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'professional.created',
          entityType: 'PartnerProfessional',
          entityId: created.id,
          after: { partnerId, profession: created.profession },
          meta
        },
        tx
      );

      return created.id;
    });

    return this.getProfessional(id);
  }

  async updateProfessional(
    actor: Principal,
    id: string,
    input: Partial<ProfessionalInput> & { status?: ProfessionalStatus },
    meta: RequestMeta
  ): Promise<ProfessionalView> {
    const current = await this.prisma.partnerProfessional.findFirst({
      where: { id, deletedAt: null }
    });

    if (current === null) {
      throw AppError.notFound('Profissional não encontrado.');
    }

    const license = this.licenseFields(current.partnerId, input.licenseNumber);

    if (license.licenseNumberHash) {
      const duplicate = await this.prisma.partnerProfessional.findFirst({
        where: {
          partnerId: current.partnerId,
          licenseNumberHash: license.licenseNumberHash,
          id: { not: id }
        },
        select: { id: true }
      });

      if (duplicate) {
        throw AppError.conflict(
          'DUPLICATE_LICENSE',
          'Já existe profissional deste parceiro com este registro.'
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.partnerProfessional.update({
        where: { id },
        data: {
          ...(input.fullName === undefined ? {} : { fullName: input.fullName.trim() }),
          ...(input.profession === undefined ? {} : { profession: input.profession.trim() }),
          ...license,
          ...(input.email === undefined
            ? {}
            : { email: input.email?.trim().toLowerCase() || null }),
          ...(input.phone === undefined ? {} : { phone: input.phone }),
          ...(input.publicBio === undefined ? {} : { publicBio: input.publicBio }),
          ...(input.publicContact === undefined ? {} : { publicContact: input.publicContact }),
          ...(input.status === undefined ? {} : { status: input.status })
        }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'professional.updated',
          entityType: 'PartnerProfessional',
          entityId: id,
          before: { status: current.status, publicContact: current.publicContact },
          after: {
            fields: Object.keys(input).filter((key) => key !== 'licenseNumber'),
            ...(license.licenseNumberHash === undefined ? {} : { licenseNumber: 'alterado' }),
            ...(input.status === undefined ? {} : { status: input.status })
          },
          meta
        },
        tx
      );
    });

    return this.getProfessional(id);
  }

  // ---------- Serviços ----------

  async listServices(partnerId?: string): Promise<ServiceView[]> {
    const rows = await this.prisma.partnerService.findMany({
      where: { deletedAt: null, ...(partnerId ? { partnerId } : {}) },
      include: SERVICE_INCLUDE,
      orderBy: { name: 'asc' }
    });

    return rows.map((row) => this.serviceView(row));
  }

  async getService(id: string): Promise<ServiceView> {
    const row = await this.prisma.partnerService.findFirst({
      where: { id, deletedAt: null },
      include: SERVICE_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Serviço não encontrado.');
    }

    return this.serviceView(row);
  }

  private async assertProfessionalOf(partnerId: string, professionalId: string): Promise<void> {
    const professional = await this.prisma.partnerProfessional.findFirst({
      where: { id: professionalId, partnerId, deletedAt: null },
      select: { id: true }
    });

    if (professional === null) {
      throw AppError.validation(
        'INVALID_PROFESSIONAL',
        'O profissional precisa pertencer ao mesmo parceiro do serviço.'
      );
    }
  }

  async createService(
    actor: Principal,
    partnerId: string,
    input: ServiceInput,
    meta: RequestMeta
  ): Promise<ServiceView> {
    const partner = await this.prisma.partner.findFirst({
      where: { id: partnerId, deletedAt: null },
      select: { status: true }
    });

    if (partner === null) {
      throw AppError.notFound('Parceiro não encontrado.');
    }

    if (partner.status !== 'ACTIVE') {
      throw AppError.conflict(
        'PARTNER_NOT_APPROVED',
        'Aprove o parceiro antes de cadastrar serviços.'
      );
    }

    if (input.professionalId) {
      await this.assertProfessionalOf(partnerId, input.professionalId);
    }

    const id = await this.prisma.$transaction(async (tx) => {
      const created = await tx.partnerService.create({
        data: {
          partnerId,
          professionalId: input.professionalId ?? null,
          name: input.name.trim(),
          description: input.description ?? null,
          durationMinutes: input.durationMinutes,
          price: input.price ?? null,
          currency: input.price ? DEFAULT_CURRENCY : null
        }
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'service.created',
          entityType: 'PartnerService',
          entityId: created.id,
          after: {
            partnerId,
            name: created.name,
            price: input.price?.toFixed(2) ?? null,
            durationMinutes: created.durationMinutes
          },
          meta
        },
        tx
      );

      return created.id;
    });

    return this.getService(id);
  }

  async updateService(
    actor: Principal,
    id: string,
    input: Partial<ServiceInput>,
    meta: RequestMeta
  ): Promise<ServiceView> {
    const current = await this.prisma.partnerService.findFirst({ where: { id, deletedAt: null } });

    if (current === null) {
      throw AppError.notFound('Serviço não encontrado.');
    }

    if (input.professionalId) {
      await this.assertProfessionalOf(current.partnerId, input.professionalId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.partnerService.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.durationMinutes === undefined
            ? {}
            : { durationMinutes: input.durationMinutes }),
          ...(input.price === undefined
            ? {}
            : { price: input.price, currency: input.price ? DEFAULT_CURRENCY : null }),
          ...(input.professionalId === undefined ? {} : { professionalId: input.professionalId })
        }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'service.updated',
          entityType: 'PartnerService',
          entityId: id,
          before: {
            price: current.price?.toFixed(2) ?? null,
            durationMinutes: current.durationMinutes
          },
          after: {
            fields: Object.keys(input),
            ...(input.price === undefined ? {} : { price: input.price?.toFixed(2) ?? null })
          },
          meta
        },
        tx
      );
    });

    return this.getService(id);
  }

  async changeServiceStatus(
    actor: Principal,
    id: string,
    status: ServiceStatus,
    meta: RequestMeta
  ): Promise<ServiceView> {
    const current = await this.prisma.partnerService.findFirst({
      where: { id, deletedAt: null },
      include: { partner: true }
    });

    if (current === null) {
      throw AppError.notFound('Serviço não encontrado.');
    }

    assertTransition(SERVICE_TRANSITIONS, current.status, status, {
      DRAFT: 'Rascunho',
      ACTIVE: 'Ativo',
      INACTIVE: 'Inativo'
    });

    if (status === 'ACTIVE' && current.partner.status !== 'ACTIVE') {
      throw AppError.conflict('PARTNER_NOT_APPROVED', 'O parceiro não está ativo.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.partnerService.update({ where: { id }, data: { status } });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'service.status.changed',
          entityType: 'PartnerService',
          entityId: id,
          before: { status: current.status },
          after: { status },
          meta
        },
        tx
      );
    });

    return this.getService(id);
  }

  // ---------- Disponibilidade ----------

  async listAvailability(
    professionalId: string,
    range: { from?: Date; to?: Date } = {}
  ): Promise<AvailabilityView[]> {
    const rows = await this.prisma.professionalAvailability.findMany({
      where: {
        professionalId,
        ...(range.from ? { endsAt: { gt: range.from } } : {}),
        ...(range.to ? { startsAt: { lt: range.to } } : {})
      },
      include: { appointment: { select: { id: true } } },
      orderBy: { startsAt: 'asc' },
      take: 500
    });

    return rows.map((row) => this.availabilityView(row));
  }

  /**
   * RCF-011: intervalos do mesmo profissional não se sobrepõem. A trava na linha do
   * profissional serializa inclusões concorrentes.
   */
  async addAvailability(
    actor: Principal,
    professionalId: string,
    input: { startsAt: string; endsAt: string; serviceId?: string; notes?: string },
    meta: RequestMeta
  ): Promise<AvailabilityView> {
    const interval = { startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) };
    const invalid = invalidInterval(interval, new Date());

    if (invalid) {
      throw AppError.validation('INVALID_INTERVAL', invalid);
    }

    const id = await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'professional', professionalId);
      const professional = await tx.partnerProfessional.findFirst({
        where: { id: professionalId, deletedAt: null }
      });

      if (professional === null) {
        throw AppError.notFound('Profissional não encontrado.');
      }

      if (professional.status !== 'ACTIVE') {
        throw AppError.conflict('PROFESSIONAL_INACTIVE', 'O profissional está inativo.');
      }

      if (input.serviceId) {
        const service = await tx.partnerService.findFirst({
          where: { id: input.serviceId, partnerId: professional.partnerId, deletedAt: null }
        });

        if (service === null) {
          throw AppError.validation('INVALID_SERVICE', 'Serviço inexistente para este parceiro.');
        }

        if (!fitsDuration(interval, service.durationMinutes)) {
          throw AppError.validation(
            'INTERVAL_TOO_SHORT',
            `O intervalo é menor que a duração do serviço (${service.durationMinutes} min).`
          );
        }
      }

      const existing = await tx.professionalAvailability.findMany({
        where: {
          professionalId,
          status: { in: ['AVAILABLE', 'RESERVED'] },
          startsAt: { lt: interval.endsAt },
          endsAt: { gt: interval.startsAt }
        },
        select: { startsAt: true, endsAt: true }
      });

      if (existing.some((slot) => overlaps(slot, interval))) {
        throw AppError.conflict(
          'AVAILABILITY_OVERLAP',
          'Já existe horário deste profissional que se sobrepõe ao informado.'
        );
      }

      const created = await tx.professionalAvailability.create({
        data: {
          professionalId,
          partnerServiceId: input.serviceId ?? null,
          startsAt: interval.startsAt,
          endsAt: interval.endsAt,
          notes: input.notes ?? null
        }
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'availability.created',
          entityType: 'ProfessionalAvailability',
          entityId: created.id,
          after: {
            professionalId,
            startsAt: interval.startsAt.toISOString(),
            endsAt: interval.endsAt.toISOString()
          },
          meta
        },
        tx
      );

      return created.id;
    });

    const row = await this.prisma.professionalAvailability.findUniqueOrThrow({
      where: { id },
      include: { appointment: { select: { id: true } } }
    });

    return this.availabilityView(row);
  }

  /** Bloqueia um horário livre (não apaga: o histórico da agenda permanece). */
  async blockAvailability(
    actor: Principal,
    id: string,
    reason: string,
    meta: RequestMeta
  ): Promise<AvailabilityView> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'availability', id);
      const slot = await tx.professionalAvailability.findUnique({ where: { id } });

      if (slot === null) {
        throw AppError.notFound('Horário não encontrado.');
      }

      if (slot.status !== 'AVAILABLE') {
        throw AppError.conflict(
          'SLOT_NOT_FREE',
          'Somente horários livres podem ser bloqueados. Cancele o agendamento antes.'
        );
      }

      await tx.professionalAvailability.update({ where: { id }, data: { status: 'BLOCKED' } });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'availability.blocked',
          entityType: 'ProfessionalAvailability',
          entityId: id,
          reason,
          before: { status: slot.status },
          after: { status: 'BLOCKED' },
          meta
        },
        tx
      );
    });

    const row = await this.prisma.professionalAvailability.findUniqueOrThrow({
      where: { id },
      include: { appointment: { select: { id: true } } }
    });

    return this.availabilityView(row);
  }

  /**
   * Horários livres e futuros de um serviço oferecido publicamente (consulta antes do
   * agendamento, RCF-011). Não expõe quem reservou os demais horários.
   */
  async publicSlots(
    serviceId: string
  ): Promise<{ service: ServiceView; slots: AvailabilityView[] }> {
    const service = await this.prisma.partnerService.findFirst({
      where: {
        id: serviceId,
        deletedAt: null,
        status: 'ACTIVE',
        partner: operationalPartnerWhere(todayIn())
      },
      include: SERVICE_INCLUDE
    });

    if (service === null) {
      throw AppError.notFound('Serviço não encontrado.');
    }

    const now = new Date();
    const rows = await this.prisma.professionalAvailability.findMany({
      where: {
        status: 'AVAILABLE',
        startsAt: { gt: now },
        OR: [{ partnerServiceId: serviceId }, { partnerServiceId: null }],
        professional: {
          deletedAt: null,
          status: 'ACTIVE',
          partnerId: service.partnerId,
          ...(service.professionalId ? { id: service.professionalId } : {})
        }
      },
      include: { appointment: { select: { id: true } } },
      orderBy: { startsAt: 'asc' },
      take: 200
    });

    return {
      service: this.serviceView(service),
      slots: rows
        .filter((row) => fitsDuration(row, service.durationMinutes))
        .map((row) => ({ ...this.availabilityView(row), appointmentId: null }))
    };
  }
}
