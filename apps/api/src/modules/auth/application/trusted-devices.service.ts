import { Injectable } from '@nestjs/common';

import { AuditService } from '../../../common/audit/audit.service';
import { generateOpaqueToken, sha256Hex } from '../../../common/crypto/tokens';
import { AppError } from '../../../common/errors/app-error';
import type { RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import {
  deviceLabel,
  MAX_TRUSTED_DEVICES,
  trustedDeviceExpiry
} from '../domain/trusted-device-rules';

export interface TrustedDeviceView {
  readonly id: string;
  readonly label: string;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly expiresAt: string;
  /** É o navegador desta requisição. */
  readonly current: boolean;
}

const hashOf = (token: string) => sha256Hex(`trusted-device:${token}`);

/**
 * Navegadores lembrados na segunda etapa (DT-050). O token aleatório fica num cookie
 * HttpOnly; o banco guarda só o hash, ligado à conta. Lembrar um navegador vale 30 dias
 * e pode ser desfeito a qualquer momento.
 */
@Injectable()
export class TrustedDevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /** Cria a confiança e devolve o token para o cookie. */
  async remember(
    tx: PrismaTx,
    userId: string,
    meta: RequestMeta
  ): Promise<{ token: string; expiresAt: Date }> {
    const now = new Date();
    const token = generateOpaqueToken();
    const expiresAt = trustedDeviceExpiry(now);
    const device = await tx.trustedDevice.create({
      data: {
        userId,
        tokenHash: hashOf(token),
        label: deviceLabel(meta.userAgent),
        createdAt: now,
        lastUsedAt: now,
        expiresAt
      }
    });
    const active = await tx.trustedDevice.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true }
    });
    const excess = active.slice(MAX_TRUSTED_DEVICES).map((row) => row.id);

    if (excess.length > 0) {
      await tx.trustedDevice.updateMany({
        where: { id: { in: excess } },
        data: { revokedAt: now, revocationReason: 'Limite de dispositivos lembrados' }
      });
    }

    await this.audit.record(
      {
        actorUserId: userId,
        action: 'auth.trusted_device.created',
        entityType: 'TrustedDevice',
        entityId: device.id,
        after: { label: device.label, expiresAt: expiresAt.toISOString() },
        meta
      },
      tx
    );

    return { token, expiresAt };
  }

  /** Confere o token do cookie para a conta; atualiza o último uso quando vale. */
  async check(userId: string, token: string | undefined, now: Date = new Date()): Promise<boolean> {
    if (!token) {
      return false;
    }

    const used = await this.prisma.trustedDevice.updateMany({
      where: { userId, tokenHash: hashOf(token), revokedAt: null, expiresAt: { gt: now } },
      data: { lastUsedAt: now }
    });

    return used.count === 1;
  }

  async list(userId: string, currentToken: string | undefined): Promise<TrustedDeviceView[]> {
    const currentHash = currentToken ? hashOf(currentToken) : null;
    const rows = await this.prisma.trustedDevice.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' }
    });

    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      current: row.tokenHash === currentHash
    }));
  }

  async forget(userId: string, id: string, meta: RequestMeta): Promise<void> {
    const result = await this.prisma.trustedDevice.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: 'Esquecido pela pessoa' }
    });

    if (result.count === 0) {
      throw AppError.notFound('Dispositivo não encontrado.');
    }

    await this.audit.record({
      actorUserId: userId,
      action: 'auth.trusted_device.revoked',
      entityType: 'TrustedDevice',
      entityId: id,
      meta
    });
  }

  /** Esquece todos (troca de senha, segunda etapa desativada ou redefinida, pedido da pessoa). */
  async forgetAll(userId: string, reason: string, tx?: PrismaTx): Promise<number> {
    const result = await (tx ?? this.prisma).trustedDevice.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: reason.slice(0, 120) }
    });

    return result.count;
  }
}
