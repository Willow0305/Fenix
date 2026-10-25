import { Injectable } from '@nestjs/common';

import { AuditService } from '../../../common/audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { ageOn, dateToCivil, todayIn } from '../../../common/domain/civil-date';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  IMAGE_POLICY,
  type IncomingFile,
  MediaService,
  mediaUrl
} from '../../media/application/media.service';
import { REVOCATION } from '../domain/auth-rules';

export interface ProfileView {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly athleteId: string | null;
  /** Foto de perfil; abre só para a própria pessoa e a diretoria enquanto privada (DT-044). */
  readonly avatarUrl: string | null;
  readonly profilePublic: boolean;
  /**
   * Para atleta menor de 18 (ou sem data de nascimento): o perfil só aparece no site
   * depois de a diretoria registrar a autorização do responsável.
   */
  readonly publicProfile: {
    readonly isAthlete: boolean;
    readonly needsGuardianConsent: boolean;
    readonly visibleOnSite: boolean;
  };
  readonly createdAt: string;
  /** Segunda etapa: `required` para perfis privilegiados; `verified` nesta sessão (DT-037). */
  readonly mfa: {
    readonly enabled: boolean;
    readonly required: boolean;
    readonly verified: boolean;
  };
}

export interface SessionView {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly current: boolean;
}

/** Perfil e sessões do próprio usuário (recurso "Próprio" da matriz). */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService
  ) {}

  async profile(principal: Principal): Promise<ProfileView> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        mfaEnabledAt: true,
        avatarMediaFileId: true,
        profilePublic: true,
        athlete: {
          select: {
            id: true,
            deletedAt: true,
            status: true,
            birthDate: true,
            publicProfileConsentAt: true
          }
        }
      }
    });
    const athlete = user.athlete && user.athlete.deletedAt === null ? user.athlete : null;
    const needsGuardianConsent =
      athlete !== null &&
      (athlete.birthDate === null || ageOn(dateToCivil(athlete.birthDate), todayIn()) < 18) &&
      athlete.publicProfileConsentAt === null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      roles: principal.roles,
      permissions: [...principal.permissions].sort(),
      athleteId: athlete?.id ?? null,
      avatarUrl: user.avatarMediaFileId ? mediaUrl(user.avatarMediaFileId) : null,
      profilePublic: user.profilePublic,
      publicProfile: {
        isAthlete: athlete !== null,
        needsGuardianConsent,
        visibleOnSite:
          athlete !== null &&
          athlete.status === 'ACTIVE' &&
          user.profilePublic &&
          !needsGuardianConsent
      },
      createdAt: user.createdAt.toISOString(),
      mfa: {
        enabled: user.mfaEnabledAt !== null,
        required: principal.privileged,
        verified: principal.mfaVerified
      }
    };
  }

  async updateProfile(
    principal: Principal,
    input: { name?: string; phone?: string },
    meta: RequestMeta
  ): Promise<ProfileView> {
    const before = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: { name: true, phone: true }
    });
    const data = {
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.phone === undefined ? {} : { phone: input.phone.trim() || null })
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: principal.userId }, data });
      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'user.profile.updated',
          entityType: 'User',
          entityId: principal.userId,
          before,
          after: data,
          meta
        },
        tx
      );
    });

    return this.profile(principal);
  }

  /**
   * Envia ou troca a foto de perfil (DT-044): imagem otimizada (DT-039), pública só se a
   * pessoa já escolheu perfil público. A foto anterior deixa de abrir (exclusão lógica).
   */
  async setAvatar(
    principal: Principal,
    file: IncomingFile | undefined,
    meta: RequestMeta
  ): Promise<ProfileView> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: { avatarMediaFileId: true, profilePublic: true }
    });

    await this.prisma.$transaction(async (tx) => {
      const stored = await this.media.store(
        file,
        {
          ...IMAGE_POLICY,
          optimize: { maxWidth: 800, maxHeight: 800 },
          kind: 'IMAGE',
          classification: user.profilePublic ? 'PUBLIC' : 'INTERNAL'
        },
        principal.userId,
        tx
      );

      await tx.user.update({
        where: { id: principal.userId },
        data: { avatarMediaFileId: stored.id }
      });

      if (user.avatarMediaFileId) {
        await tx.mediaFile.update({
          where: { id: user.avatarMediaFileId },
          data: { deletedAt: new Date() }
        });
      }

      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'user.avatar.updated',
          entityType: 'User',
          entityId: principal.userId,
          before: { avatarMediaFileId: user.avatarMediaFileId },
          after: { avatarMediaFileId: stored.id },
          meta
        },
        tx
      );
    });

    return this.profile(principal);
  }

  async removeAvatar(principal: Principal, meta: RequestMeta): Promise<ProfileView> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: { avatarMediaFileId: true }
    });

    if (user.avatarMediaFileId) {
      const avatarId = user.avatarMediaFileId;

      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: principal.userId },
          data: { avatarMediaFileId: null }
        });
        await tx.mediaFile.update({ where: { id: avatarId }, data: { deletedAt: new Date() } });
        await this.audit.record(
          {
            actorUserId: principal.userId,
            action: 'user.avatar.removed',
            entityType: 'User',
            entityId: principal.userId,
            before: { avatarMediaFileId: avatarId },
            meta
          },
          tx
        );
      });
    }

    return this.profile(principal);
  }

  /** Perfil público ou privado: muda também quem pode abrir a foto (PUBLIC/INTERNAL). */
  async setProfileVisibility(
    principal: Principal,
    isPublic: boolean,
    meta: RequestMeta
  ): Promise<ProfileView> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: { avatarMediaFileId: true, profilePublic: true }
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: principal.userId }, data: { profilePublic: isPublic } });

      if (user.avatarMediaFileId) {
        await tx.mediaFile.update({
          where: { id: user.avatarMediaFileId },
          data: { classification: isPublic ? 'PUBLIC' : 'INTERNAL' }
        });
      }

      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'user.profile_visibility.changed',
          entityType: 'User',
          entityId: principal.userId,
          before: { profilePublic: user.profilePublic },
          after: { profilePublic: isPublic },
          meta
        },
        tx
      );
    });

    return this.profile(principal);
  }

  async sessions(principal: Principal): Promise<SessionView[]> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId: principal.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, expiresAt: true }
    });

    return sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === principal.sessionId
    }));
  }

  async revokeSession(principal: Principal, sessionId: string, meta: RequestMeta): Promise<void> {
    const result = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId: principal.userId, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: REVOCATION.revokedByUser }
    });

    if (result.count === 0) {
      throw AppError.notFound('Sessão não encontrada.');
    }

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'auth.session.revoked',
      entityType: 'UserSession',
      entityId: sessionId,
      meta
    });
  }
}
