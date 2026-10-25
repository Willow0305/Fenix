import { Injectable } from '@nestjs/common';
import type { CommissionType, PartnerStatus, PartnerType, Prisma } from '@prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { AppConfig } from '../../../common/config/app-config';
import { decryptField, encryptField } from '../../../common/crypto/data-cipher';
import { sha256Hex } from '../../../common/crypto/tokens';
import { civilToDate, optionalCivil, todayIn } from '../../../common/domain/civil-date';
import {
  DEFAULT_CURRENCY,
  type Money,
  type MoneyView,
  moneyView
} from '../../../common/domain/money';
import { assertTransition } from '../../../common/domain/state-machine';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { lockRow } from '../../finance/application/ledger.service';
import {
  DOCUMENT_POLICY,
  IMAGE_POLICY,
  type IncomingFile,
  MediaService,
  mediaUrl
} from '../../media/application/media.service';
import { normalizeDocument } from '../../sports/domain/sports-rules';
import {
  invalidCommission,
  operationalPartnerWhere,
  PARTNER_STATUS_LABELS,
  PARTNER_TRANSITIONS,
  partnerOperational
} from '../domain/partner-rules';

export interface PartnerDocumentView {
  readonly id: string;
  readonly documentType: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly issuedOn: string | null;
  readonly expiresOn: string | null;
  readonly createdAt: string;
}

export interface PartnerView {
  readonly id: string;
  readonly legalName: string;
  readonly displayName: string;
  readonly type: PartnerType;
  readonly status: PartnerStatus;
  readonly operational: boolean;
  readonly documentNumberMasked: string | null;
  readonly contactName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly description: string | null;
  readonly websiteUrl: string | null;
  readonly contractStartsOn: string | null;
  readonly contractEndsOn: string | null;
  readonly logoUrl: string | null;
  readonly coverUrl: string | null;
  readonly commissionType: CommissionType;
  readonly commissionPercentage: string | null;
  readonly commissionFixedAmount: MoneyView | null;
  readonly contractNotes: string | null;
  readonly counts: { products: number; professionals: number; services: number };
  /** Presente somente para quem tem `partner.documents.read` (RN-PAR-004). */
  readonly documents?: PartnerDocumentView[];
  readonly createdAt: string;
}

export interface PublicProfessionalView {
  readonly id: string;
  readonly fullName: string;
  readonly profession: string;
  readonly publicBio: string | null;
  readonly email: string | null;
  readonly phone: string | null;
}

export interface PublicServiceView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly durationMinutes: number;
  readonly price: MoneyView | null;
  readonly professional: { id: string; fullName: string } | null;
}

export interface PublicPartnerView {
  readonly id: string;
  readonly displayName: string;
  readonly type: PartnerType;
  readonly description: string | null;
  readonly websiteUrl: string | null;
  readonly logoUrl: string | null;
  /** Capa 16:9 (PEN-058, DT-041). */
  readonly coverUrl: string | null;
  readonly professionals: PublicProfessionalView[];
  readonly services: PublicServiceView[];
  readonly products: { id: string; name: string; slug: string }[];
}

export interface PartnerInput {
  readonly legalName: string;
  readonly displayName: string;
  readonly type: PartnerType;
  readonly documentNumber?: string | null;
  readonly contactName?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly description?: string | null;
  readonly websiteUrl?: string | null;
  readonly contractStartsOn?: string | null;
  readonly contractEndsOn?: string | null;
  readonly commissionType?: CommissionType;
  readonly commissionPercentage?: Money | null;
  readonly commissionFixedAmount?: Money | null;
  readonly contractNotes?: string | null;
}

export interface PartnerFilters extends PageQueryDto {
  readonly status?: PartnerStatus;
  readonly type?: PartnerType;
}

const PARTNER_INCLUDE = {
  _count: {
    select: {
      products: { where: { deletedAt: null } },
      professionals: { where: { deletedAt: null } },
      services: { where: { deletedAt: null } }
    }
  }
} satisfies Prisma.PartnerInclude;

type PartnerRow = Prisma.PartnerGetPayload<{ include: typeof PARTNER_INCLUDE }>;

const PUBLIC_PARTNER_INCLUDE = {
  professionals: {
    where: { deletedAt: null, status: 'ACTIVE' },
    orderBy: { fullName: 'asc' }
  },
  services: {
    where: { deletedAt: null, status: 'ACTIVE' },
    include: { professional: { select: { id: true, fullName: true, status: true } } },
    orderBy: { name: 'asc' }
  },
  products: {
    where: { deletedAt: null, status: { in: ['ACTIVE', 'SOLD_OUT'] } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
    take: 12
  }
} satisfies Prisma.PartnerInclude;

type PublicPartnerRow = Prisma.PartnerGetPayload<{ include: typeof PUBLIC_PARTNER_INCLUDE }>;

function civilOrNull(value: string | null | undefined): Date | null {
  return value ? civilToDate(value) : null;
}

/** Parceiros sob curadoria (RF-031, RCF-010, RN-PAR-001/004, DT-033). */
@Injectable()
export class PartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly config: AppConfig
  ) {}

  private mask(encrypted: string | null): string | null {
    if (encrypted === null) {
      return null;
    }

    const plain = decryptField(encrypted, this.config.values.dataEncryptionKey);

    return plain.length <= 4 ? '****' : `${'*'.repeat(plain.length - 4)}${plain.slice(-4)}`;
  }

  private async toView(row: PartnerRow, principal: Principal | null): Promise<PartnerView> {
    const canReadDocuments = principal?.permissions.has(PERMISSIONS.partnerDocumentsRead) ?? false;
    const documents = canReadDocuments
      ? await this.prisma.partnerDocument.findMany({
          where: { partnerId: row.id, deletedAt: null },
          include: { mediaFile: { select: { originalName: true, mimeType: true } } },
          orderBy: { createdAt: 'desc' }
        })
      : null;

    return {
      id: row.id,
      legalName: row.legalName,
      displayName: row.displayName,
      type: row.type,
      status: row.status,
      operational: partnerOperational(row, todayIn()),
      documentNumberMasked: this.mask(row.documentNumberEncrypted),
      contactName: row.contactName,
      email: row.email,
      phone: row.phone,
      description: row.description,
      websiteUrl: row.websiteUrl,
      contractStartsOn: optionalCivil(row.contractStartsOn),
      contractEndsOn: optionalCivil(row.contractEndsOn),
      logoUrl: row.logoMediaFileId ? mediaUrl(row.logoMediaFileId) : null,
      coverUrl: row.coverMediaFileId ? mediaUrl(row.coverMediaFileId) : null,
      commissionType: row.commissionType,
      commissionPercentage: row.commissionPercentage?.toFixed(2) ?? null,
      commissionFixedAmount: row.commissionFixedAmount
        ? moneyView(row.commissionFixedAmount, row.commissionCurrency ?? DEFAULT_CURRENCY)
        : null,
      contractNotes: row.contractNotes,
      counts: {
        products: row._count.products,
        professionals: row._count.professionals,
        services: row._count.services
      },
      ...(documents === null
        ? {}
        : {
            documents: documents.map((doc) => ({
              id: doc.id,
              documentType: doc.documentType,
              fileName: doc.mediaFile.originalName,
              mimeType: doc.mediaFile.mimeType,
              issuedOn: optionalCivil(doc.issuedOn),
              expiresOn: optionalCivil(doc.expiresOn),
              createdAt: doc.createdAt.toISOString()
            }))
          }),
      createdAt: row.createdAt.toISOString()
    };
  }

  private async load(id: string): Promise<PartnerRow> {
    const row = await this.prisma.partner.findFirst({
      where: { id, deletedAt: null },
      include: PARTNER_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Parceiro não encontrado.');
    }

    return row;
  }

  async list(filters: PartnerFilters): Promise<Page<PartnerView>> {
    const { skip, take, page, pageSize } = pageArgs(filters);
    const search = filters.search?.trim();
    const where: Prisma.PartnerWhereInput = {
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: 'insensitive' } },
              { legalName: { contains: search, mode: 'insensitive' } }
            ]
          }
        : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.partner.findMany({
        where,
        include: PARTNER_INCLUDE,
        orderBy: { displayName: 'asc' },
        skip,
        take
      }),
      this.prisma.partner.count({ where })
    ]);
    // A listagem nunca carrega documentos, mesmo para quem pode lê-los.
    return toPage(
      await Promise.all(rows.map((row) => this.toView(row, null))),
      total,
      page,
      pageSize
    );
  }

  async get(id: string, principal: Principal): Promise<PartnerView> {
    return this.toView(await this.load(id), principal);
  }

  /** Cifra o documento (CNPJ/CPF) e gera hash para detectar duplicidade sem revelá-lo. */
  private documentFields(document: string | null | undefined): {
    documentNumberEncrypted?: string | null;
    documentNumberHash?: string | null;
  } {
    if (document === undefined) {
      return {};
    }

    const normalized = document ? normalizeDocument(document) : '';

    return normalized
      ? {
          documentNumberEncrypted: encryptField(normalized, this.config.values.dataEncryptionKey),
          documentNumberHash: sha256Hex(`partner-doc:${normalized}`)
        }
      : { documentNumberEncrypted: null, documentNumberHash: null };
  }

  private async assertUniqueDocument(hash: string | null | undefined, ignoreId?: string) {
    if (!hash) {
      return;
    }

    const existing = await this.prisma.partner.findFirst({
      where: { documentNumberHash: hash, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true }
    });

    if (existing) {
      throw AppError.conflict('DUPLICATE_DOCUMENT', 'Já existe parceiro com este documento.');
    }
  }

  private commissionData(
    input: Partial<PartnerInput>,
    current?: PartnerRow
  ): {
    commissionType?: CommissionType;
    commissionPercentage?: Money | null;
    commissionFixedAmount?: Money | null;
    commissionCurrency?: string | null;
  } {
    if (
      input.commissionType === undefined &&
      input.commissionPercentage === undefined &&
      input.commissionFixedAmount === undefined
    ) {
      return {};
    }

    const type = input.commissionType ?? current?.commissionType ?? 'NONE';
    const rule = {
      type,
      percentage:
        type === 'PERCENTAGE'
          ? (input.commissionPercentage ?? current?.commissionPercentage ?? null)
          : null,
      fixedAmount:
        type === 'FIXED'
          ? (input.commissionFixedAmount ?? current?.commissionFixedAmount ?? null)
          : null
    };
    const invalid = invalidCommission(rule);

    if (invalid) {
      throw AppError.validation('INVALID_COMMISSION', invalid);
    }

    return {
      commissionType: rule.type,
      commissionPercentage: rule.percentage,
      commissionFixedAmount: rule.fixedAmount,
      commissionCurrency: rule.fixedAmount ? DEFAULT_CURRENCY : null
    };
  }

  private assertContract(starts: Date | null, ends: Date | null): void {
    if (starts && ends && ends < starts) {
      throw AppError.validation(
        'INVALID_CONTRACT',
        'O fim da vigência não pode ser anterior ao início.'
      );
    }
  }

  async create(actor: Principal, input: PartnerInput, meta: RequestMeta): Promise<PartnerView> {
    const document = this.documentFields(input.documentNumber);

    await this.assertUniqueDocument(document.documentNumberHash);

    const starts = civilOrNull(input.contractStartsOn);
    const ends = civilOrNull(input.contractEndsOn);

    this.assertContract(starts, ends);

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.partner.create({
        data: {
          legalName: input.legalName.trim(),
          displayName: input.displayName.trim(),
          type: input.type,
          status: 'PENDING',
          documentNumberEncrypted: document.documentNumberEncrypted ?? null,
          documentNumberHash: document.documentNumberHash ?? null,
          contactName: input.contactName ?? null,
          email: input.email?.trim().toLowerCase() ?? null,
          phone: input.phone ?? null,
          description: input.description ?? null,
          websiteUrl: input.websiteUrl ?? null,
          contractStartsOn: starts,
          contractEndsOn: ends,
          contractNotes: input.contractNotes ?? null,
          ...this.commissionData(input)
        }
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'partner.created',
          entityType: 'Partner',
          entityId: created.id,
          after: {
            displayName: created.displayName,
            type: created.type,
            commissionType: created.commissionType
          },
          meta
        },
        tx
      );

      return created;
    });

    return this.get(row.id, actor);
  }

  async update(
    actor: Principal,
    id: string,
    input: Partial<PartnerInput>,
    meta: RequestMeta
  ): Promise<PartnerView> {
    const current = await this.load(id);

    if (current.status === 'ENDED') {
      throw AppError.conflict('PARTNER_ENDED', 'Parceiro encerrado não pode ser alterado.');
    }

    const document = this.documentFields(input.documentNumber);

    await this.assertUniqueDocument(document.documentNumberHash, id);

    const starts =
      input.contractStartsOn === undefined
        ? current.contractStartsOn
        : civilOrNull(input.contractStartsOn);
    const ends =
      input.contractEndsOn === undefined
        ? current.contractEndsOn
        : civilOrNull(input.contractEndsOn);

    this.assertContract(starts, ends);

    const commission = this.commissionData(input, current);

    await this.prisma.$transaction(async (tx) => {
      await tx.partner.update({
        where: { id },
        data: {
          ...(input.legalName === undefined ? {} : { legalName: input.legalName.trim() }),
          ...(input.displayName === undefined ? {} : { displayName: input.displayName.trim() }),
          ...(input.type === undefined ? {} : { type: input.type }),
          ...document,
          ...(input.contactName === undefined ? {} : { contactName: input.contactName }),
          ...(input.email === undefined
            ? {}
            : { email: input.email?.trim().toLowerCase() || null }),
          ...(input.phone === undefined ? {} : { phone: input.phone }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.websiteUrl === undefined ? {} : { websiteUrl: input.websiteUrl }),
          ...(input.contractNotes === undefined ? {} : { contractNotes: input.contractNotes }),
          contractStartsOn: starts,
          contractEndsOn: ends,
          ...commission
        }
      });

      // Mudanças comerciais registram valores anterior e novo (RN-PAR-004).
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'partner.updated',
          entityType: 'Partner',
          entityId: id,
          before: {
            commissionType: current.commissionType,
            commissionPercentage: current.commissionPercentage?.toFixed(4) ?? null,
            commissionFixedAmount: current.commissionFixedAmount?.toFixed(2) ?? null,
            contractStartsOn: optionalCivil(current.contractStartsOn),
            contractEndsOn: optionalCivil(current.contractEndsOn)
          },
          after: {
            fields: Object.keys(input).filter((key) => key !== 'documentNumber'),
            ...(document.documentNumberHash === undefined ? {} : { documentNumber: 'alterado' }),
            ...('commissionType' in commission
              ? {
                  commissionType: commission.commissionType,
                  commissionPercentage: commission.commissionPercentage?.toFixed(4) ?? null,
                  commissionFixedAmount: commission.commissionFixedAmount?.toFixed(2) ?? null
                }
              : {}),
            contractStartsOn: optionalCivil(starts),
            contractEndsOn: optionalCivil(ends)
          },
          meta
        },
        tx
      );
    });

    return this.get(id, actor);
  }

  /** Aprovação/inativação/encerramento (RN-PAR-001); ativar exige início de vigência. */
  async changeStatus(
    actor: Principal,
    id: string,
    status: PartnerStatus,
    reason: string | undefined,
    meta: RequestMeta
  ): Promise<PartnerView> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'partner', id);
      const current = await tx.partner.findFirst({ where: { id, deletedAt: null } });

      if (current === null) {
        throw AppError.notFound('Parceiro não encontrado.');
      }

      assertTransition(PARTNER_TRANSITIONS, current.status, status, PARTNER_STATUS_LABELS);

      if (status === 'ACTIVE' && current.contractStartsOn === null) {
        throw AppError.validation(
          'CONTRACT_REQUIRED',
          'Informe o início da vigência do contrato antes de aprovar o parceiro.'
        );
      }

      if ((status === 'INACTIVE' || status === 'ENDED') && !reason) {
        throw AppError.validation('REASON_REQUIRED', 'Informe o motivo.');
      }

      await tx.partner.update({ where: { id }, data: { status } });

      if (status === 'INACTIVE' || status === 'ENDED') {
        // Serviços deixam de ser oferecidos; agendamentos existentes seguem para decisão manual.
        await tx.partnerService.updateMany({
          where: { partnerId: id, status: 'ACTIVE' },
          data: { status: 'INACTIVE' }
        });
      }

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'partner.status.changed',
          entityType: 'Partner',
          entityId: id,
          reason: reason ?? null,
          before: { status: current.status },
          after: { status },
          meta
        },
        tx
      );
    });

    return this.get(id, actor);
  }

  async setLogo(
    actor: Principal,
    id: string,
    file: IncomingFile | undefined,
    meta: RequestMeta
  ): Promise<PartnerView> {
    const current = await this.load(id);

    await this.prisma.$transaction(async (tx) => {
      const stored = await this.media.store(
        file,
        { ...IMAGE_POLICY, kind: 'IMAGE', classification: 'PUBLIC' },
        actor.userId,
        tx
      );

      await tx.partner.update({ where: { id }, data: { logoMediaFileId: stored.id } });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'partner.logo.updated',
          entityType: 'Partner',
          entityId: id,
          before: { logoMediaFileId: current.logoMediaFileId },
          after: { logoMediaFileId: stored.id },
          meta
        },
        tx
      );
    });

    return this.get(id, actor);
  }

  /** Capa 16:9 do parceiro (PEN-058, DT-041): imagem pública otimizada em WebP. */
  async setCover(
    actor: Principal,
    id: string,
    file: IncomingFile | undefined,
    meta: RequestMeta
  ): Promise<PartnerView> {
    const current = await this.load(id);

    await this.prisma.$transaction(async (tx) => {
      const stored = await this.media.store(
        file,
        { ...IMAGE_POLICY, kind: 'IMAGE', classification: 'PUBLIC' },
        actor.userId,
        tx
      );

      await tx.partner.update({ where: { id }, data: { coverMediaFileId: stored.id } });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'partner.cover.updated',
          entityType: 'Partner',
          entityId: id,
          before: { coverMediaFileId: current.coverMediaFileId },
          after: { coverMediaFileId: stored.id },
          meta
        },
        tx
      );
    });

    return this.get(id, actor);
  }

  /** Documento/contrato do parceiro: sempre CONFIDENTIAL (RN-PAR-004). */
  async addDocument(
    actor: Principal,
    id: string,
    input: { documentType: string; issuedOn?: string; expiresOn?: string },
    file: IncomingFile | undefined,
    meta: RequestMeta
  ): Promise<PartnerView> {
    await this.load(id);

    await this.prisma.$transaction(async (tx) => {
      const stored = await this.media.store(
        file,
        { ...DOCUMENT_POLICY, kind: 'CONTRACT', classification: 'CONFIDENTIAL' },
        actor.userId,
        tx
      );
      const doc = await tx.partnerDocument.create({
        data: {
          partnerId: id,
          mediaFileId: stored.id,
          documentType: input.documentType.trim(),
          issuedOn: civilOrNull(input.issuedOn),
          expiresOn: civilOrNull(input.expiresOn)
        }
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'partner.document.added',
          entityType: 'Partner',
          entityId: id,
          after: { documentId: doc.id, documentType: doc.documentType },
          meta
        },
        tx
      );
    });

    return this.get(id, actor);
  }

  async removeDocument(
    actor: Principal,
    id: string,
    documentId: string,
    reason: string,
    meta: RequestMeta
  ): Promise<PartnerView> {
    const doc = await this.prisma.partnerDocument.findFirst({
      where: { id: documentId, partnerId: id, deletedAt: null }
    });

    if (doc === null) {
      throw AppError.notFound('Documento não encontrado.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.partnerDocument.update({
        where: { id: documentId },
        data: { deletedAt: new Date() }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'partner.document.removed',
          entityType: 'Partner',
          entityId: id,
          reason,
          before: { documentId, documentType: doc.documentType },
          meta
        },
        tx
      );
    });

    return this.get(id, actor);
  }

  /** Download autorizado pela permissão de domínio; cada leitura é auditada. */
  async documentFile(actor: Principal, id: string, documentId: string, meta: RequestMeta) {
    const doc = await this.prisma.partnerDocument.findFirst({
      where: { id: documentId, partnerId: id, deletedAt: null },
      select: { mediaFileId: true }
    });

    if (doc === null) {
      throw AppError.notFound('Documento não encontrado.');
    }

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'partner.document.read',
      entityType: 'Partner',
      entityId: id,
      after: { documentId },
      meta
    });

    return this.media.read(doc.mediaFileId, actor, true);
  }

  // ---------- Público ----------

  /** Uma única consulta para a lista pública (evita N+1; medido no teste de carga, DT-035). */
  async publicList(): Promise<PublicPartnerView[]> {
    const rows = await this.prisma.partner.findMany({
      where: operationalPartnerWhere(todayIn()),
      include: PUBLIC_PARTNER_INCLUDE,
      orderBy: { displayName: 'asc' }
    });

    return rows.map((row) => this.publicView(row));
  }

  /** Visão pública: só parceiro operacional; profissionais exibem contato apenas se autorizado. */
  async publicGet(id: string): Promise<PublicPartnerView> {
    const row = await this.prisma.partner.findFirst({
      where: { id, ...operationalPartnerWhere(todayIn()) },
      include: PUBLIC_PARTNER_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Parceiro não encontrado.');
    }

    return this.publicView(row);
  }

  private publicView(row: PublicPartnerRow): PublicPartnerView {
    return {
      id: row.id,
      displayName: row.displayName,
      type: row.type,
      description: row.description,
      websiteUrl: row.websiteUrl,
      logoUrl: row.logoMediaFileId ? mediaUrl(row.logoMediaFileId) : null,
      coverUrl: row.coverMediaFileId ? mediaUrl(row.coverMediaFileId) : null,
      professionals: row.professionals.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        profession: p.profession,
        publicBio: p.publicBio,
        email: p.publicContact ? p.email : null,
        phone: p.publicContact ? p.phone : null
      })),
      services: row.services
        .filter((s) => s.professional === null || s.professional.status === 'ACTIVE')
        .map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          durationMinutes: s.durationMinutes,
          price: s.price ? moneyView(s.price, s.currency ?? DEFAULT_CURRENCY) : null,
          professional: s.professional
            ? { id: s.professional.id, fullName: s.professional.fullName }
            : null
        })),
      products: row.products
    };
  }
}
