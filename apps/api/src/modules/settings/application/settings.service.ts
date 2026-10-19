import { Injectable } from '@nestjs/common';
import { Prisma, type TeamBrandContext } from '@prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { AppConfig } from '../../../common/config/app-config';
import { decryptField, DATA_KEY_VERSION, encryptField } from '../../../common/crypto/data-cipher';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import {
  IMAGE_POLICY,
  type IncomingFile,
  MediaService,
  mediaUrl
} from '../../media/application/media.service';

export const SETTINGS_KEY = 'default';

export interface SocialLink {
  readonly label: string;
  readonly url: string;
}

export interface PublicTeamSettings {
  readonly teamName: string;
  readonly officialName: string;
  readonly description: string | null;
  readonly history: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly socialLinks: readonly SocialLink[];
  readonly address: {
    readonly line1: string | null;
    readonly line2: string | null;
    readonly city: string | null;
    readonly state: string | null;
    readonly postalCode: string | null;
    readonly country: string | null;
  };
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
  readonly currency: string;
  readonly timeZone: string;
  readonly termsOfUse: string | null;
  readonly privacyPolicy: string | null;
  readonly monthlyFeeRules: string | null;
  readonly storeRules: string | null;
  readonly pickupInstructions: string | null;
  readonly brandAssets: Partial<Record<TeamBrandContext, { url: string; altText: string | null }>>;
}

export interface AdminTeamSettings extends PublicTeamSettings {
  readonly updatedAt: string;
  readonly updatedBy: string | null;
  readonly financial: {
    readonly pixKey: string | null;
    readonly bankingDetails: string | null;
  } | null;
}

export type PublicSettingsPatch = Partial<{
  teamName: string;
  officialName: string;
  description: string | null;
  history: string | null;
  email: string | null;
  phone: string | null;
  socialLinks: SocialLink[];
  addressLine1: string | null;
  addressLine2: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  timeZone: string;
  termsOfUse: string | null;
  privacyPolicy: string | null;
  monthlyFeeRules: string | null;
  storeRules: string | null;
  pickupInstructions: string | null;
}>;

const SETTINGS_INCLUDE = {
  brandAssets: { select: { context: true, altText: true, mediaFileId: true } },
  updatedBy: { select: { name: true } }
} satisfies Prisma.TeamSettingsInclude;

type SettingsRow = Prisma.TeamSettingsGetPayload<{ include: typeof SETTINGS_INCLUDE }>;

function parseSocialLinks(value: Prisma.JsonValue | null): SocialLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      const label = item['label'];
      const url = item['url'];

      if (typeof label === 'string' && typeof url === 'string') {
        return [{ label, url }];
      }
    }

    return [];
  });
}

export function defaultSettingsData(): Prisma.TeamSettingsCreateInput {
  return {
    singletonKey: SETTINGS_KEY,
    teamName: 'Fênix Vôlei',
    officialName: 'Time Fênix Volleyball',
    description: 'Time de vôlei que renasce a cada jogo.',
    primaryColor: '#CD151D',
    secondaryColor: '#0B0613',
    defaultCurrency: 'BRL',
    timeZone: 'America/Rio_Branco'
  };
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly config: AppConfig
  ) {}

  private async load(tx?: PrismaTx): Promise<SettingsRow> {
    const client = tx ?? this.prisma;

    return client.teamSettings.upsert({
      where: { singletonKey: SETTINGS_KEY },
      create: defaultSettingsData(),
      update: {},
      include: SETTINGS_INCLUDE
    });
  }

  private toPublic(row: SettingsRow): PublicTeamSettings {
    return {
      teamName: row.teamName,
      officialName: row.officialName,
      description: row.description,
      history: row.history,
      email: row.email,
      phone: row.phone,
      socialLinks: parseSocialLinks(row.socialLinks),
      address: {
        line1: row.addressLine1,
        line2: row.addressLine2,
        city: row.addressCity,
        state: row.addressState,
        postalCode: row.addressPostalCode,
        country: row.addressCountry
      },
      primaryColor: row.primaryColor,
      secondaryColor: row.secondaryColor,
      currency: row.defaultCurrency,
      timeZone: row.timeZone,
      termsOfUse: row.termsOfUse,
      privacyPolicy: row.privacyPolicy,
      monthlyFeeRules: row.monthlyFeeRules,
      storeRules: row.storeRules,
      pickupInstructions: row.pickupInstructions,
      brandAssets: Object.fromEntries(
        row.brandAssets.map((asset) => [
          asset.context,
          { url: mediaUrl(asset.mediaFileId), altText: asset.altText }
        ])
      )
    };
  }

  async getPublic(): Promise<PublicTeamSettings> {
    return this.toPublic(await this.load());
  }

  private decrypt(value: string | null): string | null {
    return value === null ? null : decryptField(value, this.config.values.dataEncryptionKey);
  }

  async getAdmin(principal: Principal): Promise<AdminTeamSettings> {
    const row = await this.load();
    const canSeeFinancial = principal.permissions.has(PERMISSIONS.settingsFinancialManage);

    return {
      ...this.toPublic(row),
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy?.name ?? null,
      financial: canSeeFinancial
        ? {
            pixKey: this.decrypt(row.pixKeyEncrypted),
            bankingDetails: this.decrypt(row.bankingDetailsEncrypted)
          }
        : null
    };
  }

  /** Chave PIX exibida a usuários autenticados para pagamentos (RN-CFG-002: não é pública). */
  async getPaymentInfo(): Promise<{ pixKey: string | null; bankingDetails: string | null }> {
    const row = await this.load();

    return {
      pixKey: this.decrypt(row.pixKeyEncrypted),
      bankingDetails: this.decrypt(row.bankingDetailsEncrypted)
    };
  }

  async updatePublic(
    principal: Principal,
    patch: PublicSettingsPatch,
    meta: RequestMeta
  ): Promise<AdminTeamSettings> {
    await this.prisma.$transaction(async (tx) => {
      const before = await this.load(tx);
      const { socialLinks, ...rest } = patch;
      const data: Prisma.TeamSettingsUpdateInput = {
        ...rest,
        ...(socialLinks === undefined
          ? {}
          : { socialLinks: socialLinks as unknown as Prisma.InputJsonValue }),
        updatedBy: { connect: { id: principal.userId } }
      };

      await tx.teamSettings.update({ where: { singletonKey: SETTINGS_KEY }, data });

      const changedKeys = Object.keys(patch) as (keyof PublicSettingsPatch)[];

      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'settings.public.updated',
          entityType: 'TeamSettings',
          entityId: before.id,
          before: Object.fromEntries(
            changedKeys.map((key) => [key, (before as Record<string, unknown>)[key] ?? null])
          ),
          after: patch as Record<string, unknown>,
          meta
        },
        tx
      );
    });

    return this.getAdmin(principal);
  }

  /** Dados financeiros são cifrados e a auditoria registra apenas quais campos mudaram. */
  async updateFinancial(
    principal: Principal,
    input: { pixKey?: string | null; bankingDetails?: string | null },
    meta: RequestMeta
  ): Promise<AdminTeamSettings> {
    const key = this.config.values.dataEncryptionKey;
    const encrypt = (value: string | null | undefined): string | null | undefined =>
      value === undefined
        ? undefined
        : value === null || value.trim() === ''
          ? null
          : encryptField(value.trim(), key);
    const pix = encrypt(input.pixKey);
    const banking = encrypt(input.bankingDetails);

    await this.prisma.$transaction(async (tx) => {
      const row = await this.load(tx);

      await tx.teamSettings.update({
        where: { singletonKey: SETTINGS_KEY },
        data: {
          ...(pix === undefined ? {} : { pixKeyEncrypted: pix }),
          ...(banking === undefined ? {} : { bankingDetailsEncrypted: banking }),
          encryptionKeyVersion: DATA_KEY_VERSION,
          updatedBy: { connect: { id: principal.userId } }
        }
      });
      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'settings.financial.updated',
          entityType: 'TeamSettings',
          entityId: row.id,
          metadata: {
            changed: [
              ...(pix === undefined ? [] : ['pixKey']),
              ...(banking === undefined ? [] : ['bankingDetails'])
            ]
          },
          meta
        },
        tx
      );
    });

    return this.getAdmin(principal);
  }

  async setBrandAsset(
    principal: Principal,
    context: TeamBrandContext,
    file: IncomingFile | undefined,
    altText: string | null,
    meta: RequestMeta
  ): Promise<AdminTeamSettings> {
    await this.prisma.$transaction(async (tx) => {
      const settings = await this.load(tx);
      const stored = await this.media.store(
        file,
        { ...IMAGE_POLICY, kind: 'IMAGE', classification: 'PUBLIC' },
        principal.userId,
        tx
      );
      const previous = settings.brandAssets.find((asset) => asset.context === context);

      await tx.teamBrandAsset.upsert({
        where: { teamSettingsId_context: { teamSettingsId: settings.id, context } },
        create: { teamSettingsId: settings.id, context, mediaFileId: stored.id, altText },
        update: { mediaFileId: stored.id, altText }
      });
      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'settings.brand_asset.updated',
          entityType: 'TeamBrandAsset',
          entityId: settings.id,
          before: { context, mediaFileId: previous?.mediaFileId ?? null },
          after: { context, mediaFileId: stored.id },
          meta
        },
        tx
      );
    });

    return this.getAdmin(principal);
  }
}
