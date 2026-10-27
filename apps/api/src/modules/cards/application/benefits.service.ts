import { Injectable } from '@nestjs/common';
import type { BenefitAudience, Prisma } from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { civilToDate, optionalCivil, todayIn } from '../../../common/domain/civil-date';
import { money } from '../../../common/domain/money';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { mediaUrl } from '../../media/application/media.service';

export interface BenefitView {
  readonly id: string;
  /** `id` nulo: parceiro sem cadastro no site, só com nome e contato (DT-074). */
  readonly partner: {
    id: string | null;
    name: string;
    logoUrl: string | null;
    details: string | null;
  };
  readonly title: string;
  readonly discountPercent: string;
  readonly conditions: string | null;
  readonly audience: BenefitAudience;
}

export interface BenefitAdminView extends BenefitView {
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly isActive: boolean;
  /** Visível agora: ativo, no período e (se cadastrado) de parceiro ativo. */
  readonly inEffect: boolean;
}

export interface BenefitInput {
  /** Parceiro cadastrado; ou então `partnerName` (parceiro sem cadastro). */
  readonly partnerId?: string | null;
  readonly partnerName?: string | null;
  readonly partnerDetails?: string | null;
  readonly title: string;
  readonly discountPercent: string;
  readonly conditions?: string | null;
  readonly audience: BenefitAudience;
  readonly startsOn?: string | null;
  readonly endsOn?: string | null;
}

const INCLUDE = {
  partner: {
    select: { id: true, displayName: true, logoMediaFileId: true, status: true, deletedAt: true }
  }
} satisfies Prisma.PartnerBenefitInclude;

type Row = Prisma.PartnerBenefitGetPayload<{ include: typeof INCLUDE }>;

const BENEFIT_ORDER: Prisma.PartnerBenefitOrderByWithRelationInput[] = [
  { partner: { displayName: 'asc' } },
  { partnerName: 'asc' },
  { discountPercent: 'desc' }
];

/** Onde o benefício está valendo hoje (ativo, no período e de parceiro ativo). */
function inEffectWhere(today: string): Prisma.PartnerBenefitWhereInput {
  const day = civilToDate(today);

  return {
    deletedAt: null,
    isActive: true,
    AND: [
      { OR: [{ partnerId: null }, { partner: { status: 'ACTIVE', deletedAt: null } }] },
      { OR: [{ startsOn: null }, { startsOn: { lte: day } }] },
      { OR: [{ endsOn: null }, { endsOn: { gte: day } }] }
    ]
  };
}

/** Benefícios de parceiros para quem tem carteirinha (DT-068 D). */
@Injectable()
export class BenefitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private view(row: Row): BenefitView {
    return {
      id: row.id,
      partner: row.partner
        ? {
            id: row.partner.id,
            name: row.partner.displayName,
            logoUrl: row.partner.logoMediaFileId ? mediaUrl(row.partner.logoMediaFileId) : null,
            details: null
          }
        : {
            id: null,
            name: row.partnerName ?? '',
            logoUrl: null,
            details: row.partnerDetails
          },
      title: row.title,
      discountPercent: row.discountPercent.toFixed(0),
      conditions: row.conditions,
      audience: row.audience
    };
  }

  /** Benefícios valendo hoje para um tipo de carteirinha. */
  async forCard(type: 'ATHLETE' | 'AFFILIATE', today: string = todayIn()): Promise<BenefitView[]> {
    const rows = await this.prisma.partnerBenefit.findMany({
      where: {
        ...inEffectWhere(today),
        audience: { in: ['BOTH', type === 'ATHLETE' ? 'ATHLETES' : 'AFFILIATES'] }
      },
      include: INCLUDE,
      orderBy: BENEFIT_ORDER
    });

    return rows.map((row) => this.view(row));
  }

  /** Quantos benefícios estão valendo no dia (visão geral da aba Afiliação). */
  countInEffect(today: string): Promise<number> {
    return this.prisma.partnerBenefit.count({ where: inEffectWhere(today) });
  }

  /** Todos os benefícios valendo hoje (site: página de benefícios e dos parceiros). */
  async publicList(partnerId?: string): Promise<BenefitView[]> {
    const rows = await this.prisma.partnerBenefit.findMany({
      where: { ...inEffectWhere(todayIn()), ...(partnerId ? { partnerId } : {}) },
      include: INCLUDE,
      orderBy: BENEFIT_ORDER
    });

    return rows.map((row) => this.view(row));
  }

  async adminList(partnerId?: string): Promise<BenefitAdminView[]> {
    const today = todayIn();
    const [rows, effective] = await Promise.all([
      this.prisma.partnerBenefit.findMany({
        where: { deletedAt: null, ...(partnerId ? { partnerId } : {}) },
        include: INCLUDE,
        orderBy: [{ partner: { displayName: 'asc' } }, { createdAt: 'desc' }]
      }),
      this.prisma.partnerBenefit.findMany({
        where: { ...inEffectWhere(today), ...(partnerId ? { partnerId } : {}) },
        select: { id: true }
      })
    ]);
    const active = new Set(effective.map((row) => row.id));

    return rows.map((row) => ({
      ...this.view(row),
      startsOn: optionalCivil(row.startsOn),
      endsOn: optionalCivil(row.endsOn),
      isActive: row.isActive,
      inEffect: active.has(row.id)
    }));
  }

  private validate(input: Partial<BenefitInput>): void {
    if (input.discountPercent !== undefined) {
      const value = money(input.discountPercent);

      if (value.lt(1) || value.gt(100)) {
        throw AppError.validation('INVALID_DISCOUNT', 'O desconto deve ficar entre 1% e 100%.');
      }
    }

    if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) {
      throw AppError.validation('INVALID_PERIOD', 'O fim não pode ser antes do início.');
    }
  }

  private async load(id: string): Promise<Row> {
    const row = await this.prisma.partnerBenefit.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Benefício não encontrado.');
    }

    return row;
  }

  private async adminView(id: string): Promise<BenefitAdminView> {
    const list = await this.adminList();

    return list.find((b) => b.id === id) as BenefitAdminView;
  }

  async create(
    actor: Principal,
    input: BenefitInput,
    meta: RequestMeta
  ): Promise<BenefitAdminView> {
    this.validate(input);

    const partnerName = input.partnerName?.trim() || null;

    if ((input.partnerId ? 1 : 0) + (partnerName ? 1 : 0) !== 1) {
      throw AppError.validation(
        'PARTNER_REQUIRED',
        'Escolha um parceiro cadastrado ou informe o nome do parceiro sem cadastro.'
      );
    }

    if (input.partnerId) {
      const partner = await this.prisma.partner.findFirst({
        where: { id: input.partnerId, deletedAt: null },
        select: { id: true }
      });

      if (partner === null) {
        throw AppError.validation('INVALID_PARTNER', 'Parceiro inexistente.');
      }
    }

    const row = await this.prisma.partnerBenefit.create({
      data: {
        partnerId: input.partnerId || null,
        partnerName,
        partnerDetails: partnerName ? input.partnerDetails?.trim() || null : null,
        title: input.title.trim(),
        discountPercent: input.discountPercent,
        conditions: input.conditions?.trim() || null,
        audience: input.audience,
        startsOn: input.startsOn ? civilToDate(input.startsOn) : null,
        endsOn: input.endsOn ? civilToDate(input.endsOn) : null
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'benefits.created',
      entityType: 'PartnerBenefit',
      entityId: row.id,
      after: {
        partnerId: row.partnerId,
        partnerName: row.partnerName,
        title: row.title,
        discountPercent: input.discountPercent
      },
      meta
    });

    return this.adminView(row.id);
  }

  async update(
    actor: Principal,
    id: string,
    input: Partial<Omit<BenefitInput, 'partnerId'>> & { isActive?: boolean },
    meta: RequestMeta
  ): Promise<BenefitAdminView> {
    const before = await this.load(id);

    if (
      before.partnerId !== null &&
      (input.partnerName !== undefined || input.partnerDetails !== undefined)
    ) {
      throw AppError.validation(
        'REGISTERED_PARTNER',
        'Este benefício é de um parceiro cadastrado; o nome vem do cadastro dele.'
      );
    }

    if (input.partnerName !== undefined && !input.partnerName?.trim()) {
      throw AppError.validation('PARTNER_REQUIRED', 'Informe o nome do parceiro.');
    }

    this.validate({
      ...input,
      startsOn: input.startsOn === undefined ? optionalCivil(before.startsOn) : input.startsOn,
      endsOn: input.endsOn === undefined ? optionalCivil(before.endsOn) : input.endsOn
    });

    await this.prisma.partnerBenefit.update({
      where: { id },
      data: {
        ...(input.partnerName ? { partnerName: input.partnerName.trim() } : {}),
        ...(input.partnerDetails === undefined
          ? {}
          : { partnerDetails: input.partnerDetails?.trim() || null }),
        ...(input.title === undefined ? {} : { title: input.title.trim() }),
        ...(input.discountPercent === undefined ? {} : { discountPercent: input.discountPercent }),
        ...(input.conditions === undefined ? {} : { conditions: input.conditions?.trim() || null }),
        ...(input.audience === undefined ? {} : { audience: input.audience }),
        ...(input.startsOn === undefined
          ? {}
          : { startsOn: input.startsOn ? civilToDate(input.startsOn) : null }),
        ...(input.endsOn === undefined
          ? {}
          : { endsOn: input.endsOn ? civilToDate(input.endsOn) : null }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'benefits.updated',
      entityType: 'PartnerBenefit',
      entityId: id,
      before: {
        partnerName: before.partnerName,
        partnerDetails: before.partnerDetails,
        title: before.title,
        discountPercent: before.discountPercent.toFixed(2),
        isActive: before.isActive
      },
      after: input as Record<string, unknown>,
      meta
    });

    return this.adminView(id);
  }

  async remove(actor: Principal, id: string, reason: string, meta: RequestMeta): Promise<void> {
    const before = await this.load(id);

    await this.prisma.partnerBenefit.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'benefits.deleted',
      entityType: 'PartnerBenefit',
      entityId: id,
      reason,
      before: { title: before.title, discountPercent: before.discountPercent.toFixed(2) },
      meta
    });
  }
}
