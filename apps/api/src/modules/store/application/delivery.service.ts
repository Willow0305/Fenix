import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { type Money, money, type MoneyView, moneyView } from '../../../common/domain/money';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { defaultSettingsData, SETTINGS_KEY } from '../../settings/application/settings.service';
import {
  type AddressInput,
  addressProblems,
  cleanPostalCode,
  type DeliveryAddress,
  normalizeNeighborhood,
  parseNeighborhoods
} from '../domain/delivery';

export interface DeliveryZoneView {
  readonly id: string;
  readonly name: string;
  readonly fee: MoneyView;
  readonly leadDays: number;
  readonly isActive: boolean;
  readonly neighborhoods: { id: string; name: string }[];
}

export interface DeliveryOptions {
  readonly enabled: boolean;
  readonly city: string;
  readonly state: string;
  readonly freeMinimum: MoneyView | null;
  readonly zones: DeliveryZoneView[];
}

export interface AddressView {
  readonly id: string;
  readonly label: string | null;
  readonly postalCode: string;
  readonly street: string;
  readonly number: string;
  readonly complement: string | null;
  readonly neighborhoodId: string | null;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
  readonly reference: string | null;
  readonly phone: string | null;
  readonly isDefault: boolean;
  /** O bairro ainda é atendido (região ativa). */
  readonly served: boolean;
}

export interface SavedAddressInput extends AddressInput {
  readonly neighborhoodId: string;
  readonly label?: string | null | undefined;
  readonly isDefault?: boolean | undefined;
}

export interface ZoneInput {
  readonly name: string;
  readonly fee: Money;
  readonly leadDays: number;
  readonly neighborhoods: readonly string[];
}

/** Resultado da conferência do endereço no checkout. */
export interface ResolvedDelivery {
  readonly zoneId: string;
  readonly zoneFee: Money;
  readonly freeMinimum: Money | null;
  readonly address: DeliveryAddress;
}

const ZONE_INCLUDE = {
  neighborhoods: {
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true }
  }
} satisfies Prisma.DeliveryZoneInclude;

type ZoneRow = Prisma.DeliveryZoneGetPayload<{ include: typeof ZONE_INCLUDE }>;

const ACTIVE_ZONE = { isActive: true, deletedAt: null } as const;

/** Endereço completo vindo do ViaCEP (consulta pela API, sem dado pessoal além do CEP). */
interface ViaCepResponse {
  readonly erro?: boolean | string;
  readonly logradouro?: string;
  readonly bairro?: string;
  readonly localidade?: string;
  readonly uf?: string;
}

/**
 * Entrega em casa (DT-075): regiões e bairros de Rio Branco configurados pela diretoria,
 * frete grátis, endereços salvos pelo usuário e conferência do endereço no checkout.
 */
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger('Entrega');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private zoneView(row: ZoneRow): DeliveryZoneView {
    return {
      id: row.id,
      name: row.name,
      fee: moneyView(row.fee, row.currency),
      leadDays: row.leadDays,
      isActive: row.isActive,
      neighborhoods: row.neighborhoods
    };
  }

  /** Configuração única do time; criada com os padrões se ainda não existir. */
  private settings(tx: PrismaTx | PrismaService = this.prisma) {
    return tx.teamSettings.upsert({
      where: { singletonKey: SETTINGS_KEY },
      create: defaultSettingsData(),
      update: {},
      select: {
        id: true,
        deliveryEnabled: true,
        deliveryCity: true,
        deliveryState: true,
        freeDeliveryMinimum: true
      }
    });
  }

  /** Para o carrinho: entrega ligada, cidade, frete grátis e regiões ativas com bairros. */
  async publicOptions(): Promise<DeliveryOptions> {
    const settings = await this.settings();
    const enabled = settings.deliveryEnabled;
    const zones = enabled
      ? await this.prisma.deliveryZone.findMany({
          where: ACTIVE_ZONE,
          include: ZONE_INCLUDE,
          orderBy: [{ sortOrder: 'asc' }, { fee: 'asc' }, { name: 'asc' }]
        })
      : [];

    return {
      enabled: enabled && zones.length > 0,
      city: settings.deliveryCity,
      state: settings.deliveryState,
      freeMinimum: settings.freeDeliveryMinimum ? moneyView(settings.freeDeliveryMinimum) : null,
      zones: zones.map((zone) => this.zoneView(zone))
    };
  }

  /** Painel: configuração e todas as regiões (inclusive inativas). */
  async adminOptions(): Promise<DeliveryOptions & { configuredEnabled: boolean }> {
    const settings = await this.settings();
    const zones = await this.prisma.deliveryZone.findMany({
      where: { deletedAt: null },
      include: ZONE_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { fee: 'asc' }, { name: 'asc' }]
    });

    return {
      enabled: settings.deliveryEnabled && zones.some((zone) => zone.isActive),
      configuredEnabled: settings.deliveryEnabled,
      city: settings.deliveryCity,
      state: settings.deliveryState,
      freeMinimum: settings.freeDeliveryMinimum ? moneyView(settings.freeDeliveryMinimum) : null,
      zones: zones.map((zone) => this.zoneView(zone))
    };
  }

  async updateSettings(
    actor: Principal,
    input: { enabled?: boolean; city?: string; state?: string; freeMinimum?: Money | null },
    meta: RequestMeta
  ): Promise<DeliveryOptions & { configuredEnabled: boolean }> {
    const before = await this.settings();

    if (input.enabled && (await this.prisma.deliveryZone.count({ where: ACTIVE_ZONE })) === 0) {
      throw AppError.validation(
        'NO_ZONES',
        'Cadastre ao menos uma região ativa com bairros antes de ligar a entrega.'
      );
    }

    if (input.freeMinimum && input.freeMinimum.lte(0)) {
      throw AppError.validation(
        'INVALID_MINIMUM',
        'O mínimo do frete grátis deve ser maior que zero.'
      );
    }

    const data = {
      ...(input.enabled === undefined ? {} : { deliveryEnabled: input.enabled }),
      ...(input.city === undefined ? {} : { deliveryCity: input.city.trim() }),
      ...(input.state === undefined ? {} : { deliveryState: input.state.trim().toUpperCase() }),
      ...(input.freeMinimum === undefined ? {} : { freeDeliveryMinimum: input.freeMinimum })
    };

    await this.prisma.teamSettings.update({ where: { singletonKey: SETTINGS_KEY }, data });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'delivery.settings.updated',
      entityType: 'TeamSettings',
      entityId: before.id,
      before: {
        enabled: before.deliveryEnabled,
        city: before.deliveryCity,
        freeMinimum: before.freeDeliveryMinimum?.toFixed(2) ?? null
      },
      after: {
        ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
        ...(input.city === undefined ? {} : { city: input.city }),
        ...(input.freeMinimum === undefined
          ? {}
          : { freeMinimum: input.freeMinimum?.toFixed(2) ?? null })
      },
      meta
    });

    return this.adminOptions();
  }

  private validateZone(input: Partial<ZoneInput>): void {
    if (input.name !== undefined && input.name.trim().length < 2) {
      throw AppError.validation('INVALID_NAME', 'Informe o nome da região.');
    }

    if (input.fee !== undefined && input.fee.lt(0)) {
      throw AppError.validation('INVALID_FEE', 'A taxa não pode ser negativa.');
    }

    if (input.neighborhoods !== undefined && parseNeighborhoods(input.neighborhoods).length === 0) {
      throw AppError.validation('NEIGHBORHOODS_REQUIRED', 'Informe ao menos um bairro.');
    }
  }

  /** Bairro já em outra região: um bairro tem uma só taxa (RN-ENT-002). */
  private async assertFreeNeighborhoods(
    tx: PrismaTx,
    names: readonly string[],
    zoneId: string | null
  ): Promise<void> {
    const taken = await tx.deliveryNeighborhood.findMany({
      where: {
        deletedAt: null,
        normalizedName: { in: names.map(normalizeNeighborhood) },
        zone: { deletedAt: null },
        ...(zoneId ? { zoneId: { not: zoneId } } : {})
      },
      select: { name: true, zone: { select: { name: true } } }
    });

    if (taken.length > 0) {
      throw AppError.conflict(
        'NEIGHBORHOOD_IN_OTHER_ZONE',
        `Bairro já está em outra região: ${taken.map((t) => `${t.name} (${t.zone.name})`).join(', ')}.`
      );
    }
  }

  async createZone(
    actor: Principal,
    input: ZoneInput,
    meta: RequestMeta
  ): Promise<DeliveryZoneView> {
    this.validateZone(input);

    const names = parseNeighborhoods(input.neighborhoods);
    const id = await this.prisma.$transaction(async (tx) => {
      await this.assertFreeNeighborhoods(tx, names, null);

      const zone = await tx.deliveryZone.create({
        data: {
          name: input.name.trim(),
          fee: input.fee,
          leadDays: input.leadDays,
          sortOrder: await tx.deliveryZone.count({ where: { deletedAt: null } }),
          neighborhoods: {
            create: names.map((name) => ({ name, normalizedName: normalizeNeighborhood(name) }))
          }
        }
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'delivery.zone.created',
          entityType: 'DeliveryZone',
          entityId: zone.id,
          after: {
            name: zone.name,
            fee: input.fee.toFixed(2),
            leadDays: input.leadDays,
            neighborhoods: names.length
          },
          meta
        },
        tx
      );

      return zone.id;
    });

    return this.zone(id);
  }

  private async zone(id: string): Promise<DeliveryZoneView> {
    const row = await this.prisma.deliveryZone.findFirst({
      where: { id, deletedAt: null },
      include: ZONE_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Região de entrega não encontrada.');
    }

    return this.zoneView(row);
  }

  async updateZone(
    actor: Principal,
    id: string,
    input: Partial<ZoneInput> & { isActive?: boolean },
    meta: RequestMeta
  ): Promise<DeliveryZoneView> {
    this.validateZone(input);

    await this.prisma.$transaction(async (tx) => {
      const before = await tx.deliveryZone.findFirst({
        where: { id, deletedAt: null },
        include: ZONE_INCLUDE
      });

      if (before === null) {
        throw AppError.notFound('Região de entrega não encontrada.');
      }

      let added: string[] = [];
      let removed: string[] = [];

      if (input.neighborhoods !== undefined) {
        const names = parseNeighborhoods(input.neighborhoods);
        const wanted = new Map(names.map((name) => [normalizeNeighborhood(name), name]));
        const current = new Map(
          before.neighborhoods.map((n) => [normalizeNeighborhood(n.name), n])
        );

        await this.assertFreeNeighborhoods(tx, names, id);
        added = [...wanted].filter(([key]) => !current.has(key)).map(([, name]) => name);
        removed = [...current].filter(([key]) => !wanted.has(key)).map(([, n]) => n.name);

        await tx.deliveryNeighborhood.updateMany({
          where: {
            zoneId: id,
            deletedAt: null,
            normalizedName: { in: removed.map(normalizeNeighborhood) }
          },
          data: { deletedAt: new Date() }
        });

        if (added.length > 0) {
          await tx.deliveryNeighborhood.createMany({
            data: added.map((name) => ({
              zoneId: id,
              name,
              normalizedName: normalizeNeighborhood(name)
            }))
          });
        }
      }

      await tx.deliveryZone.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.fee === undefined ? {} : { fee: input.fee }),
          ...(input.leadDays === undefined ? {} : { leadDays: input.leadDays }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive })
        }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'delivery.zone.updated',
          entityType: 'DeliveryZone',
          entityId: id,
          before: {
            name: before.name,
            fee: before.fee.toFixed(2),
            leadDays: before.leadDays,
            isActive: before.isActive
          },
          after: {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.fee === undefined ? {} : { fee: input.fee.toFixed(2) }),
            ...(input.leadDays === undefined ? {} : { leadDays: input.leadDays }),
            ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
            ...(input.neighborhoods === undefined ? {} : { added, removed })
          },
          meta
        },
        tx
      );
    });

    return this.zone(id);
  }

  /** Exclusão lógica: pedidos antigos guardam a cópia da região e do endereço. */
  async deleteZone(actor: Principal, id: string, reason: string, meta: RequestMeta): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.deliveryZone.findFirst({ where: { id, deletedAt: null } });

      if (before === null) {
        throw AppError.notFound('Região de entrega não encontrada.');
      }

      const now = new Date();

      await tx.deliveryNeighborhood.updateMany({
        where: { zoneId: id, deletedAt: null },
        data: { deletedAt: now }
      });
      await tx.deliveryZone.update({ where: { id }, data: { deletedAt: now, isActive: false } });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'delivery.zone.deleted',
          entityType: 'DeliveryZone',
          entityId: id,
          reason,
          before: { name: before.name, fee: before.fee.toFixed(2) },
          meta
        },
        tx
      );
    });
  }

  /** Bairro atendido agora (região ativa, entrega ligada); nulo se não for. */
  private async servedNeighborhood(tx: PrismaTx | PrismaService, neighborhoodId: string) {
    return tx.deliveryNeighborhood.findFirst({
      where: { id: neighborhoodId, deletedAt: null, zone: ACTIVE_ZONE },
      select: {
        id: true,
        name: true,
        zone: { select: { id: true, name: true, fee: true, leadDays: true } }
      }
    });
  }

  /**
   * Checkout com entrega (RN-ENT-001/002/004): entrega ligada, bairro atendido e endereço
   * completo. Devolve a taxa da região e a cópia do endereço que o pedido guarda.
   */
  async resolveInTx(
    tx: PrismaTx,
    input: AddressInput & { neighborhoodId: string }
  ): Promise<ResolvedDelivery> {
    const settings = await this.settings(tx);

    if (!settings.deliveryEnabled) {
      throw AppError.validation(
        'DELIVERY_DISABLED',
        'A entrega em casa não está disponível no momento. Escolha a retirada.'
      );
    }

    const problems = addressProblems(input);

    if (problems.length > 0) {
      throw AppError.validation('INVALID_ADDRESS', 'Confira o endereço de entrega.', problems);
    }

    const neighborhood = await this.servedNeighborhood(tx, input.neighborhoodId);

    if (neighborhood === null) {
      throw AppError.validation(
        'NEIGHBORHOOD_NOT_SERVED',
        'Não entregamos nesse bairro. Escolha a retirada.',
        [{ field: 'neighborhoodId', code: 'NOT_SERVED', message: 'Bairro não atendido.' }]
      );
    }

    return {
      zoneId: neighborhood.zone.id,
      zoneFee: money(neighborhood.zone.fee),
      freeMinimum: settings.freeDeliveryMinimum ? money(settings.freeDeliveryMinimum) : null,
      address: {
        postalCode: cleanPostalCode(input.postalCode) as string,
        street: input.street.trim(),
        number: input.number.trim(),
        complement: input.complement?.trim() || null,
        neighborhood: neighborhood.name,
        city: settings.deliveryCity,
        state: settings.deliveryState,
        reference: input.reference?.trim() || null,
        phone: input.phone?.trim() || null,
        zoneName: neighborhood.zone.name,
        leadDays: neighborhood.zone.leadDays
      }
    };
  }

  // ---------- Endereços do usuário ----------

  private async addressView(row: Prisma.UserAddressGetPayload<object>): Promise<AddressView> {
    const served = row.neighborhoodId
      ? (await this.servedNeighborhood(this.prisma, row.neighborhoodId)) !== null
      : false;

    return {
      id: row.id,
      label: row.label,
      postalCode: row.postalCode,
      street: row.street,
      number: row.number,
      complement: row.complement,
      neighborhoodId: row.neighborhoodId,
      neighborhood: row.neighborhood,
      city: row.city,
      state: row.state,
      reference: row.reference,
      phone: row.phone,
      isDefault: row.isDefault,
      served
    };
  }

  async myAddresses(userId: string): Promise<AddressView[]> {
    const rows = await this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
    });

    return Promise.all(rows.map((row) => this.addressView(row)));
  }

  /** Endereço do próprio usuário para o checkout; nulo se não for dele. */
  async ownAddress(tx: PrismaTx, userId: string, id: string) {
    return tx.userAddress.findFirst({ where: { id, userId } });
  }

  async addAddress(userId: string, input: SavedAddressInput): Promise<AddressView> {
    const problems = addressProblems(input);

    if (problems.length > 0) {
      throw AppError.validation('INVALID_ADDRESS', 'Confira o endereço.', problems);
    }

    const neighborhood = await this.servedNeighborhood(this.prisma, input.neighborhoodId);

    if (neighborhood === null) {
      throw AppError.validation('NEIGHBORHOOD_NOT_SERVED', 'Não entregamos nesse bairro.', [
        { field: 'neighborhoodId', code: 'NOT_SERVED', message: 'Bairro não atendido.' }
      ]);
    }

    const settings = await this.settings();
    const count = await this.prisma.userAddress.count({ where: { userId } });

    if (count >= 10) {
      throw AppError.conflict('TOO_MANY_ADDRESSES', 'Você pode guardar até 10 endereços.');
    }

    const makeDefault = input.isDefault === true || count === 0;
    const row = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.userAddress.updateMany({ where: { userId }, data: { isDefault: false } });
      }

      return tx.userAddress.create({
        data: {
          userId,
          label: input.label?.trim() || null,
          postalCode: cleanPostalCode(input.postalCode) as string,
          street: input.street.trim(),
          number: input.number.trim(),
          complement: input.complement?.trim() || null,
          neighborhoodId: neighborhood.id,
          neighborhood: neighborhood.name,
          city: settings.deliveryCity,
          state: settings.deliveryState,
          reference: input.reference?.trim() || null,
          phone: input.phone?.trim() || null,
          isDefault: makeDefault
        }
      });
    });

    return this.addressView(row);
  }

  async removeAddress(userId: string, id: string): Promise<void> {
    // O próprio usuário apaga de vez (LGPD); pedidos guardam a cópia da compra.
    const { count } = await this.prisma.userAddress.deleteMany({ where: { id, userId } });

    if (count === 0) {
      throw AppError.notFound('Endereço não encontrado.');
    }
  }

  async setDefault(userId: string, id: string): Promise<AddressView[]> {
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.userAddress.findFirst({ where: { id, userId }, select: { id: true } });

      if (row === null) {
        throw AppError.notFound('Endereço não encontrado.');
      }

      await tx.userAddress.updateMany({ where: { userId }, data: { isDefault: false } });
      await tx.userAddress.update({ where: { id }, data: { isDefault: true } });
    });

    return this.myAddresses(userId);
  }

  /**
   * Preenche rua e bairro pelo CEP (ViaCEP, chamado pela API para não abrir o site a
   * terceiros). Falha ou CEP desconhecido devolve nulo: a pessoa digita.
   */
  async lookupPostalCode(
    value: string,
    fetcher: typeof fetch = fetch
  ): Promise<{
    postalCode: string;
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    neighborhoodId: string | null;
  } | null> {
    const postalCode = cleanPostalCode(value);

    if (postalCode === null) {
      throw AppError.validation('INVALID_POSTAL_CODE', 'CEP deve ter 8 números.');
    }

    if (process.env['POSTAL_CODE_LOOKUP'] === 'off') {
      return null;
    }

    try {
      const response = await fetcher(`https://viacep.com.br/ws/${postalCode}/json/`, {
        signal: AbortSignal.timeout(3_000)
      });

      if (!response.ok) {
        return null;
      }

      const body = (await response.json()) as ViaCepResponse;

      if (body.erro) {
        return null;
      }

      const neighborhood = body.bairro ?? '';
      const match = neighborhood
        ? await this.prisma.deliveryNeighborhood.findFirst({
            where: {
              normalizedName: normalizeNeighborhood(neighborhood),
              deletedAt: null,
              zone: ACTIVE_ZONE
            },
            select: { id: true }
          })
        : null;

      return {
        postalCode,
        street: body.logradouro ?? '',
        neighborhood,
        city: body.localidade ?? '',
        state: body.uf ?? '',
        neighborhoodId: match?.id ?? null
      };
    } catch (error) {
      this.logger.warn(
        `Consulta de CEP indisponível: ${error instanceof Error ? error.name : 'erro'}.`
      );

      return null;
    }
  }
}
