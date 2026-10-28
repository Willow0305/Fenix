import { randomInt, timingSafeEqual } from 'node:crypto';

import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { CourierKind, Prisma } from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { AppConfig } from '../../../common/config/app-config';
import { decryptField, encryptField } from '../../../common/crypto/data-cipher';
import { generateOpaqueToken, sha256Hex } from '../../../common/crypto/tokens';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { JobScheduler } from '../../../common/jobs/job-scheduler';
import { MailSender } from '../../../common/mail/mail.service';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { lockRow } from '../../finance/application/ledger.service';
import {
  IMAGE_POLICY,
  type IncomingFile,
  MediaService
} from '../../media/application/media.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { StaffAlertsService } from '../../notifications/application/staff-alerts.service';
import {
  cleanDeliveryCode,
  COURIER_LINK_HOURS,
  DELIVERY_CODE_ATTEMPTS,
  type DeliveryAddress,
  firstName,
  NOT_RECEIVED_DAYS,
  newDeliveryCode,
  notReceivedDeadline,
  type ProofKind,
  provesDelivery,
  strongerProof
} from '../domain/delivery';
import { OrdersService, type OrderView } from './orders.service';

export interface CourierInput {
  readonly name: string;
  readonly kind: CourierKind;
  readonly phone?: string | null;
  readonly vehicle?: string | null;
  readonly plate?: string | null;
}

export interface CourierView {
  readonly id: string;
  readonly name: string;
  readonly kind: CourierKind;
  readonly phone: string | null;
  readonly vehicle: string | null;
  readonly plate: string | null;
  readonly isActive: boolean;
}

/** Dados da saída: entregador cadastrado ou digitado (tudo opcional, RN-ENT-005). */
export interface DispatchInput {
  readonly courierId?: string;
  readonly courierKind?: CourierKind;
  readonly courierName?: string;
  readonly courierPhone?: string;
  readonly vehicle?: string;
  readonly plate?: string;
  readonly notes?: string;
}

/** Saída para entrega vista pela diretoria (nunca com o código do comprador). */
export interface AttemptView {
  readonly id: string;
  readonly status: 'OUT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  readonly courierKind: CourierKind | null;
  readonly courierName: string | null;
  readonly courierPhone: string | null;
  readonly vehicle: string | null;
  readonly plate: string | null;
  readonly notes: string | null;
  readonly linkActive: boolean;
  readonly linkExpiresAt: string | null;
  readonly codeAttempts: number;
  readonly receivedBy: string | null;
  readonly hasPhoto: boolean;
  readonly failureReason: string | null;
  readonly dispatchedBy: string | null;
  readonly dispatchedAt: string;
  readonly finishedAt: string | null;
}

/** O que o entregador vê pelo link, sem login (RN-ENT-007). */
export interface CourierLinkView {
  readonly orderNumber: string;
  readonly customerFirstName: string | null;
  readonly address: Omit<DeliveryAddress, 'zoneName' | 'leadDays' | 'postalCode'> | null;
  readonly status: 'OUT' | 'DONE' | 'CLOSED';
  readonly codeAttemptsLeft: number;
  readonly expiresAt: string | null;
}

export type BuyerOwner =
  { readonly userId: string } | { readonly orderNumber: string; readonly code: string };

const ATTEMPT_SELECT = {
  id: true,
  status: true,
  courierKind: true,
  courierName: true,
  courierPhone: true,
  vehicle: true,
  plate: true,
  notes: true,
  linkTokenHash: true,
  linkExpiresAt: true,
  codeAttempts: true,
  receivedBy: true,
  proofMediaFileId: true,
  failureReason: true,
  dispatchedAt: true,
  finishedAt: true,
  dispatchedBy: { select: { name: true } }
} satisfies Prisma.DeliveryAttemptSelect;

type AttemptRow = Prisma.DeliveryAttemptGetPayload<{ select: typeof ATTEMPT_SELECT }>;

/**
 * Comprovante de entrega em casa (DT-075, etapa 2): saída com entregador, código de 4 dígitos,
 * link sem login para o entregador de fora, provas, "Não recebi" e confirmação em 3 dias.
 */
@Injectable()
export class DeliveryDispatchService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
    private readonly media: MediaService,
    private readonly notifications: NotificationsService,
    private readonly staffAlerts: StaffAlertsService,
    private readonly mail: MailSender,
    private readonly jobs: JobScheduler,
    private readonly orders: OrdersService
  ) {}

  onModuleInit(): void {
    // Entrega só marcada pela diretoria e sem "Não recebi" em 3 dias fica confirmada.
    this.jobs.every('store.delivery.auto-confirm', 60 * 60_000, async () => {
      await this.autoConfirm();
    });
  }

  private get key(): Buffer {
    return this.config.values.dataEncryptionKey;
  }

  private linkUrl(token: string): string {
    return `${this.config.values.webOrigin.replace(/\/$/, '')}/entrega/${token}`;
  }

  // ---------- Entregadores ----------

  private courierView(row: Prisma.CourierGetPayload<object>): CourierView {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      phone: row.phone,
      vehicle: row.vehicle,
      plate: row.plate,
      isActive: row.isActive
    };
  }

  async couriers(): Promise<CourierView[]> {
    const rows = await this.prisma.courier.findMany({
      where: { deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    });

    return rows.map((row) => this.courierView(row));
  }

  async createCourier(
    actor: Principal,
    input: CourierInput,
    meta: RequestMeta
  ): Promise<CourierView> {
    const row = await this.prisma.courier.create({
      data: {
        name: input.name.trim(),
        kind: input.kind,
        phone: input.phone?.trim() || null,
        vehicle: input.vehicle?.trim() || null,
        plate: input.plate?.trim().toUpperCase() || null
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'delivery.courier.created',
      entityType: 'Courier',
      entityId: row.id,
      after: { name: row.name, kind: row.kind },
      meta
    });

    return this.courierView(row);
  }

  async updateCourier(
    actor: Principal,
    id: string,
    input: Partial<CourierInput> & { isActive?: boolean },
    meta: RequestMeta
  ): Promise<CourierView> {
    const before = await this.prisma.courier.findFirst({ where: { id, deletedAt: null } });

    if (before === null) {
      throw AppError.notFound('Entregador não encontrado.');
    }

    const row = await this.prisma.courier.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.kind === undefined ? {} : { kind: input.kind }),
        ...(input.phone === undefined ? {} : { phone: input.phone?.trim() || null }),
        ...(input.vehicle === undefined ? {} : { vehicle: input.vehicle?.trim() || null }),
        ...(input.plate === undefined ? {} : { plate: input.plate?.trim().toUpperCase() || null }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'delivery.courier.updated',
      entityType: 'Courier',
      entityId: id,
      before: { name: before.name, isActive: before.isActive },
      after: { name: row.name, isActive: row.isActive },
      meta
    });

    return this.courierView(row);
  }

  /** Exclusão lógica: saídas antigas guardam a cópia do nome, veículo e placa. */
  async deleteCourier(
    actor: Principal,
    id: string,
    reason: string,
    meta: RequestMeta
  ): Promise<void> {
    const before = await this.prisma.courier.findFirst({ where: { id, deletedAt: null } });

    if (before === null) {
      throw AppError.notFound('Entregador não encontrado.');
    }

    await this.prisma.courier.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'delivery.courier.deleted',
      entityType: 'Courier',
      entityId: id,
      reason,
      before: { name: before.name },
      meta
    });
  }

  // ---------- Saída para entrega ----------

  private attemptView(row: AttemptRow, now = new Date()): AttemptView {
    return {
      id: row.id,
      status: row.status,
      courierKind: row.courierKind,
      courierName: row.courierName,
      courierPhone: row.courierPhone,
      vehicle: row.vehicle,
      plate: row.plate,
      notes: row.notes,
      linkActive:
        row.status === 'OUT' &&
        row.linkTokenHash !== null &&
        row.linkExpiresAt !== null &&
        row.linkExpiresAt > now,
      linkExpiresAt: row.linkExpiresAt?.toISOString() ?? null,
      codeAttempts: row.codeAttempts,
      receivedBy: row.receivedBy,
      hasPhoto: row.proofMediaFileId !== null,
      failureReason: row.failureReason,
      dispatchedBy: row.dispatchedBy?.name ?? null,
      dispatchedAt: row.dispatchedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null
    };
  }

  async attempts(orderId: string): Promise<AttemptView[]> {
    const rows = await this.prisma.deliveryAttempt.findMany({
      where: { orderId },
      orderBy: { dispatchedAt: 'desc' },
      select: ATTEMPT_SELECT
    });

    return rows.map((row) => this.attemptView(row));
  }

  /** Link novo para o entregador (o anterior para de valer). Devolve o endereço só agora. */
  private async newLink(tx: PrismaTx, attemptId: string): Promise<string> {
    const token = generateOpaqueToken(24);

    await tx.deliveryAttempt.update({
      where: { id: attemptId },
      data: {
        linkTokenHash: sha256Hex(`courier:${token}`),
        linkExpiresAt: new Date(Date.now() + COURIER_LINK_HOURS * 3_600_000)
      }
    });

    return this.linkUrl(token);
  }

  /**
   * "Saiu para entrega" (RN-ENT-005/007): registra quem levou, gera o código do comprador (uma
   * vez por pedido) e o link do entregador; avisa o comprador com código, nome e placa.
   */
  async dispatch(
    actor: Principal,
    orderId: string,
    input: DispatchInput,
    meta: RequestMeta
  ): Promise<{ link: string; attempts: AttemptView[] }> {
    const result = await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'order', orderId);
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          fulfillment: true,
          customerUserId: true,
          customerEmail: true,
          customerName: true,
          deliveryCodeEncrypted: true
        }
      });

      if (order === null) {
        throw AppError.notFound('Pedido não encontrado.');
      }

      if (order.fulfillment !== 'DELIVERY') {
        throw AppError.conflict('PICKUP_ORDER', 'Este pedido é de retirada.');
      }

      if (order.status !== 'PAID' && order.status !== 'PROCESSING') {
        throw AppError.conflict(
          'NOT_READY_TO_DISPATCH',
          'Só sai para entrega pedido pago ou em separação.'
        );
      }

      const courier = input.courierId
        ? await tx.courier.findFirst({ where: { id: input.courierId, deletedAt: null } })
        : null;

      if (input.courierId && courier === null) {
        throw AppError.validation('INVALID_COURIER', 'Entregador não encontrado.');
      }

      const code = order.deliveryCodeEncrypted
        ? decryptField(order.deliveryCodeEncrypted, this.key)
        : newDeliveryCode(randomInt);
      const attempt = await tx.deliveryAttempt.create({
        data: {
          orderId,
          courierId: courier?.id ?? null,
          courierKind: courier?.kind ?? input.courierKind ?? null,
          courierName: courier?.name ?? (input.courierName?.trim() || null),
          courierPhone: courier?.phone ?? (input.courierPhone?.trim() || null),
          vehicle: courier?.vehicle ?? (input.vehicle?.trim() || null),
          plate: courier?.plate ?? (input.plate?.trim().toUpperCase() || null),
          notes: input.notes?.trim() || null,
          dispatchedById: actor.userId
        }
      });
      const link = await this.newLink(tx, attempt.id);
      const now = new Date();

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'OUT_FOR_DELIVERY',
          outForDeliveryAt: now,
          deliveryCodeEncrypted: order.deliveryCodeEncrypted ?? encryptField(code, this.key)
        }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'order.delivery.dispatched',
          entityType: 'Order',
          entityId: orderId,
          before: { status: order.status },
          after: {
            status: 'OUT_FOR_DELIVERY',
            attemptId: attempt.id,
            courierKind: attempt.courierKind,
            courier: attempt.courierName,
            plate: attempt.plate
          },
          meta
        },
        tx
      );

      const who = [
        firstName(attempt.courierName),
        attempt.vehicle,
        attempt.plate ? `placa ${attempt.plate}` : null
      ]
        .filter(Boolean)
        .join(' · ');
      const message = `Seu pedido ${order.orderNumber} saiu para entrega${who ? ` com ${who}` : ''}. Código de entrega: ${code} (diga ao entregador quando receber).`;

      if (order.customerUserId) {
        await this.notifications.notify(
          {
            userId: order.customerUserId,
            type: 'order.status',
            title: `Pedido ${order.orderNumber}: saiu para entrega`,
            message,
            link: `/minha-conta/pedidos/${orderId}`,
            deduplicationKey: `order-dispatch:${attempt.id}`
          },
          tx
        );
      }

      return {
        link,
        guest: order.customerUserId
          ? null
          : { email: order.customerEmail, name: order.customerName, message }
      };
    });

    if (result.guest?.email) {
      await this.mail
        .send({
          to: result.guest.email,
          subject: 'Seu pedido saiu para entrega — Fênix Vôlei',
          text: `Olá, ${result.guest.name}.\n\n${result.guest.message}`
        })
        .catch(() => undefined);
    }

    return { link: result.link, attempts: await this.attempts(orderId) };
  }

  /** Link novo (perdido ou vencido) para a saída em andamento. */
  async rotateLink(
    actor: Principal,
    orderId: string,
    meta: RequestMeta
  ): Promise<{ link: string }> {
    const link = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.deliveryAttempt.findFirst({
        where: { orderId, status: 'OUT' },
        select: { id: true }
      });

      if (attempt === null) {
        throw AppError.conflict('NOT_OUT', 'O pedido não está a caminho.');
      }

      const url = await this.newLink(tx, attempt.id);

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'order.delivery.link_rotated',
          entityType: 'Order',
          entityId: orderId,
          after: { attemptId: attempt.id },
          meta
        },
        tx
      );

      return url;
    });

    return { link };
  }

  /**
   * Fecha a saída como entregue com a prova recebida; código, foto e "Recebi" comprovam e
   * os prazos de desistência e defeito contam daqui (RN-ENT-006).
   */
  private async finishInTx(
    tx: PrismaTx,
    attemptId: string,
    orderId: string,
    proof: ProofKind,
    extra: { receivedBy?: string | null; mediaFileId?: string | null; actorId: string | null }
  ): Promise<void> {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        status: true,
        orderNumber: true,
        customerUserId: true,
        deliveryProofKind: true,
        deliveryConfirmedAt: true
      }
    });
    const now = new Date();

    await tx.deliveryAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'DELIVERED',
        finishedAt: now,
        linkTokenHash: null,
        ...(extra.receivedBy ? { receivedBy: extra.receivedBy.trim() } : {}),
        ...(extra.mediaFileId ? { proofMediaFileId: extra.mediaFileId } : {})
      }
    });
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
        deliveredAt: now,
        deliveryProofKind: strongerProof(order.deliveryProofKind, proof),
        ...(provesDelivery(proof) && order.deliveryConfirmedAt === null
          ? { deliveryConfirmedAt: now }
          : {}),
        ...(extra.mediaFileId ? { deliveryProofMediaFileId: extra.mediaFileId } : {})
      }
    });
    await this.audit.record(
      {
        actorUserId: extra.actorId,
        action: 'order.delivery.proven',
        entityType: 'Order',
        entityId: orderId,
        before: { status: order.status },
        after: { status: 'DELIVERED', proof, attemptId, receivedBy: extra.receivedBy ?? null }
      },
      tx
    );

    if (order.customerUserId) {
      await this.notifications.notify(
        {
          userId: order.customerUserId,
          type: 'order.status',
          title: `Pedido ${order.orderNumber}: entregue`,
          message: 'Pedido entregue. Obrigado por comprar com o Fênix!',
          link: `/minha-conta/pedidos/${orderId}`,
          deduplicationKey: `order-status:${orderId}:DELIVERED`
        },
        tx
      );
    }
  }

  /** Confere o código; erradas contam por saída e, no limite, só a diretoria confirma. */
  private async checkCodeInTx(
    tx: PrismaTx,
    attempt: { id: string; codeAttempts: number; orderId: string },
    code: string,
    actorId: string | null
  ): Promise<boolean> {
    const given = cleanDeliveryCode(code);

    if (attempt.codeAttempts >= DELIVERY_CODE_ATTEMPTS) {
      throw AppError.conflict(
        'TOO_MANY_CODE_ATTEMPTS',
        'Muitas tentativas de código. Peça para a diretoria confirmar a entrega.'
      );
    }

    const order = await tx.order.findUniqueOrThrow({
      where: { id: attempt.orderId },
      select: { deliveryCodeEncrypted: true }
    });
    const expected = order.deliveryCodeEncrypted
      ? decryptField(order.deliveryCodeEncrypted, this.key)
      : null;
    const ok =
      given !== null &&
      expected !== null &&
      timingSafeEqual(Buffer.from(given), Buffer.from(expected));

    if (!ok) {
      await tx.deliveryAttempt.update({
        where: { id: attempt.id },
        data: { codeAttempts: { increment: 1 } }
      });

      return false;
    }

    await this.finishInTx(tx, attempt.id, attempt.orderId, 'CODE', { actorId });

    return true;
  }

  /** Diretoria digita o código que o entregador passou por telefone ou mensagem. */
  async staffCode(
    actor: Principal,
    orderId: string,
    code: string,
    meta: RequestMeta
  ): Promise<OrderView> {
    const ok = await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'order', orderId);
      const attempt = await tx.deliveryAttempt.findFirst({
        where: { orderId, status: 'OUT' },
        select: { id: true, codeAttempts: true, orderId: true }
      });

      if (attempt === null) {
        throw AppError.conflict('NOT_OUT', 'O pedido não está a caminho.');
      }

      const right = await this.checkCodeInTx(tx, attempt, code, actor.userId);

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: right ? 'order.delivery.code_ok' : 'order.delivery.code_wrong',
          entityType: 'Order',
          entityId: orderId,
          meta
        },
        tx
      );

      return right;
    });

    if (!ok) {
      throw AppError.validation('WRONG_CODE', 'Código não confere. Confira com o comprador.');
    }

    return this.orders.get(orderId);
  }

  /** Foto anexada pela diretoria com o pedido ainda a caminho (enviada depois pelo motoboy). */
  async staffPhoto(
    actor: Principal,
    orderId: string,
    file: IncomingFile | undefined,
    receivedBy: string | null,
    meta: RequestMeta
  ): Promise<OrderView> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'order', orderId);
      const attempt = await tx.deliveryAttempt.findFirst({
        where: { orderId, status: 'OUT' },
        select: { id: true }
      });

      if (attempt === null) {
        throw AppError.conflict('NOT_OUT', 'O pedido não está a caminho.');
      }

      const stored = await this.media.store(
        file,
        { ...IMAGE_POLICY, kind: 'IMAGE', classification: 'CONFIDENTIAL' },
        actor.userId,
        tx
      );

      await this.finishInTx(tx, attempt.id, orderId, 'PHOTO', {
        receivedBy,
        mediaFileId: stored.id,
        actorId: actor.userId
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'order.delivery.photo',
          entityType: 'Order',
          entityId: orderId,
          after: { attemptId: attempt.id },
          meta
        },
        tx
      );
    });

    return this.orders.get(orderId);
  }

  // ---------- Link do entregador (sem login) ----------

  private async attemptByToken(db: PrismaTx | PrismaService, token: string) {
    const attempt = await db.deliveryAttempt.findUnique({
      where: { linkTokenHash: sha256Hex(`courier:${token}`) },
      select: {
        id: true,
        orderId: true,
        status: true,
        codeAttempts: true,
        linkExpiresAt: true,
        order: {
          select: {
            orderNumber: true,
            customerName: true,
            customerPhone: true,
            deliveryAddress: true
          }
        }
      }
    });

    // Resposta igual para link inexistente, trocado ou vencido.
    if (attempt === null || attempt.linkExpiresAt === null || attempt.linkExpiresAt < new Date()) {
      throw AppError.notFound('Link de entrega inválido ou vencido. Peça um novo à diretoria.');
    }

    return attempt;
  }

  async linkView(token: string): Promise<CourierLinkView> {
    const attempt = await this.attemptByToken(this.prisma, token);
    const address = attempt.order.deliveryAddress as DeliveryAddress | null;

    return {
      orderNumber: attempt.order.orderNumber,
      customerFirstName: firstName(attempt.order.customerName),
      address: address
        ? {
            street: address.street,
            number: address.number,
            complement: address.complement,
            neighborhood: address.neighborhood,
            city: address.city,
            state: address.state,
            reference: address.reference,
            phone: address.phone ?? attempt.order.customerPhone
          }
        : null,
      status: attempt.status === 'OUT' ? 'OUT' : 'DONE',
      codeAttemptsLeft: Math.max(0, DELIVERY_CODE_ATTEMPTS - attempt.codeAttempts),
      expiresAt: attempt.linkExpiresAt?.toISOString() ?? null
    };
  }

  async linkCode(token: string, code: string): Promise<CourierLinkView> {
    const ok = await this.prisma.$transaction(async (tx) => {
      const attempt = await this.attemptByToken(tx, token);

      await lockRow(tx, 'order', attempt.orderId);

      if (attempt.status !== 'OUT') {
        return true;
      }

      return this.checkCodeInTx(tx, attempt, code, null);
    });

    if (!ok) {
      throw AppError.validation('WRONG_CODE', 'Código não confere. Confira com quem recebeu.');
    }

    return { ...(await this.linkViewAfter(token)) };
  }

  /** Depois de entregue o link deixa de valer; a tela mostra "entrega registrada". */
  private async linkViewAfter(token: string): Promise<CourierLinkView> {
    try {
      return await this.linkView(token);
    } catch {
      return {
        orderNumber: '',
        customerFirstName: null,
        address: null,
        status: 'DONE',
        codeAttemptsLeft: 0,
        expiresAt: null
      };
    }
  }

  async linkPhoto(
    token: string,
    file: IncomingFile | undefined,
    receivedBy: string | null
  ): Promise<CourierLinkView> {
    await this.prisma.$transaction(async (tx) => {
      const attempt = await this.attemptByToken(tx, token);

      await lockRow(tx, 'order', attempt.orderId);

      if (attempt.status !== 'OUT') {
        throw AppError.conflict('ALREADY_FINISHED', 'Esta entrega já foi registrada.');
      }

      const stored = await this.media.store(
        file,
        { ...IMAGE_POLICY, kind: 'IMAGE', classification: 'CONFIDENTIAL' },
        null,
        tx
      );

      await this.finishInTx(tx, attempt.id, attempt.orderId, 'PHOTO', {
        receivedBy,
        mediaFileId: stored.id,
        actorId: null
      });
    });

    return this.linkViewAfter(token);
  }

  // ---------- Comprador: "Não recebi" ----------

  private async ownedOrderId(owner: BuyerOwner, orderId?: string): Promise<string> {
    const row = await this.prisma.order.findFirst({
      where:
        'userId' in owner
          ? { id: orderId ?? '', customerUserId: owner.userId }
          : {
              orderNumber: owner.orderNumber.trim().toUpperCase(),
              guestAccessTokenHash: sha256Hex(`order:${owner.code.trim()}`)
            },
      select: { id: true }
    });

    if (row === null) {
      throw AppError.notFound('Pedido não encontrado.');
    }

    return row.id;
  }

  /** "Não recebi" (RN-ENT-006): só com prova fraca e até 3 dias; abre ocorrência. */
  async notReceived(owner: BuyerOwner, note: string, orderId?: string): Promise<void> {
    const id = await this.ownedOrderId(owner, orderId);
    const order = await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'order', id);
      const row = await tx.order.findUniqueOrThrow({ where: { id } });

      if (notReceivedDeadline(row, new Date()) === null) {
        throw AppError.conflict(
          'NOT_RECEIVED_CLOSED',
          `O aviso "Não recebi" vale até ${NOT_RECEIVED_DAYS} dias depois da entrega marcada, quando não há prova. Fale com a diretoria.`
        );
      }

      await tx.order.update({
        where: { id },
        data: { notReceivedAt: new Date(), notReceivedNote: note.trim() }
      });
      await this.audit.record(
        {
          actorUserId: 'userId' in owner ? owner.userId : null,
          action: 'order.delivery.not_received',
          entityType: 'Order',
          entityId: id
        },
        tx
      );

      return row;
    });

    await this.staffAlerts.alert(PERMISSIONS.ordersRead, {
      type: 'staff.order.not_received',
      title: `Pedido ${order.orderNumber}: comprador diz que não recebeu`,
      message: note.trim().slice(0, 180),
      link: `/admin/pedidos/${id}`,
      key: `staff-not-received:${id}`
    });
  }

  /**
   * Desfecho do "Não recebi": nova entrega (volta para separação), estorno do pedido ou
   * manter como entregue (com o motivo, ex.: prova encontrada depois).
   */
  async resolveNotReceived(
    actor: Principal,
    orderId: string,
    action: 'REDELIVER' | 'REFUND' | 'KEEP',
    reason: string,
    meta: RequestMeta
  ): Promise<OrderView> {
    if (action === 'REFUND' && !actor.permissions.has(PERMISSIONS.paymentsCorrect)) {
      throw AppError.forbidden('Estornar pedido pago exige permissão de estorno.');
    }

    const open = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, notReceivedAt: true, notReceivedResolvedAt: true }
    });

    if (open === null) {
      throw AppError.notFound('Pedido não encontrado.');
    }

    if (open.notReceivedAt === null || open.notReceivedResolvedAt !== null) {
      throw AppError.conflict('NO_OPEN_NOT_RECEIVED', 'Não há aviso de "Não recebi" em aberto.');
    }

    // Estorno primeiro: se falhar, o aviso continua em aberto.
    if (action === 'REFUND' && open.status === 'DELIVERED') {
      await this.orders.changeStatus(actor, orderId, 'REFUNDED', { reason, restock: false }, meta);
    }

    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'order', orderId);
      const row = await tx.order.findUnique({ where: { id: orderId } });

      if (row === null) {
        throw AppError.notFound('Pedido não encontrado.');
      }

      if (row.notReceivedAt === null || row.notReceivedResolvedAt !== null) {
        throw AppError.conflict('NO_OPEN_NOT_RECEIVED', 'Não há aviso de "Não recebi" em aberto.');
      }

      const now = new Date();

      await tx.order.update({
        where: { id: orderId },
        data: {
          notReceivedResolvedAt: now,
          notReceivedResolution: action,
          ...(action === 'REDELIVER'
            ? { status: 'PROCESSING', deliveredAt: null, deliveryProofKind: null }
            : {}),
          ...(action === 'KEEP' ? { deliveryConfirmedAt: now } : {})
        }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'order.delivery.not_received_resolved',
          entityType: 'Order',
          entityId: orderId,
          reason,
          after: { resolution: action },
          meta
        },
        tx
      );

      if (row.customerUserId) {
        await this.notifications.notify(
          {
            userId: row.customerUserId,
            type: 'order.status',
            title: `Pedido ${row.orderNumber}: "Não recebi" respondido`,
            message:
              action === 'REDELIVER'
                ? `Vamos entregar de novo. ${reason}`
                : action === 'REFUND'
                  ? `O pedido será estornado. ${reason}`
                  : reason,
            link: `/minha-conta/pedidos/${orderId}`,
            deduplicationKey: `order-not-received:${orderId}`
          },
          tx
        );
      }
    });

    return this.orders.get(orderId);
  }

  /**
   * Entrega que não deu certo vira retirada (RN-ENT-001). A taxa de entrega não é devolvida:
   * é paga uma vez por pedido (decisão do responsável, 2026-10-28).
   */
  async switchToPickup(
    actor: Principal,
    orderId: string,
    input: { reason: string },
    meta: RequestMeta
  ): Promise<OrderView> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'order', orderId);
      const row = await tx.order.findUnique({ where: { id: orderId } });

      if (row === null) {
        throw AppError.notFound('Pedido não encontrado.');
      }

      if (
        row.fulfillment !== 'DELIVERY' ||
        (row.status !== 'PAID' && row.status !== 'PROCESSING')
      ) {
        throw AppError.conflict(
          'CANNOT_SWITCH',
          'Só pedido de entrega pago ou em separação pode virar retirada.'
        );
      }

      await tx.order.update({ where: { id: orderId }, data: { fulfillment: 'PICKUP' } });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'order.delivery.switched_to_pickup',
          entityType: 'Order',
          entityId: orderId,
          reason: input.reason,
          before: { fulfillment: 'DELIVERY' },
          after: { fulfillment: 'PICKUP' },
          meta
        },
        tx
      );

      if (row.customerUserId) {
        await this.notifications.notify(
          {
            userId: row.customerUserId,
            type: 'order.status',
            title: `Pedido ${row.orderNumber}: vai ser retirado`,
            message: `${input.reason} Avisamos quando estiver pronto para retirada.`,
            link: `/minha-conta/pedidos/${orderId}`,
            deduplicationKey: `order-switch-pickup:${orderId}`
          },
          tx
        );
      }
    });

    return this.orders.get(orderId);
  }

  /** Entregue só pela diretoria, sem "Não recebi" em 3 dias: fica confirmada (RN-ENT-006). */
  async autoConfirm(now: Date = new Date()): Promise<number> {
    const limit = new Date(now.getTime() - NOT_RECEIVED_DAYS * 86_400_000);
    const rows = await this.prisma.order.findMany({
      where: {
        fulfillment: 'DELIVERY',
        status: 'DELIVERED',
        deliveryConfirmedAt: null,
        notReceivedAt: null,
        deliveredAt: { lte: limit }
      },
      select: { id: true, deliveredAt: true },
      take: 200
    });

    for (const row of rows) {
      await this.prisma.order.updateMany({
        where: { id: row.id, deliveryConfirmedAt: null, notReceivedAt: null },
        data: {
          deliveryConfirmedAt: new Date(
            (row.deliveredAt as Date).getTime() + NOT_RECEIVED_DAYS * 86_400_000
          )
        }
      });
    }

    return rows.length;
  }
}
