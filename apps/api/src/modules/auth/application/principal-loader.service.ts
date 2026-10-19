import { Injectable } from '@nestjs/common';

import { AppConfig } from '../../../common/config/app-config';
import { verifyAccessToken } from '../../../common/crypto/jwt';
import type { Principal } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Resolve o principal a partir do access token. Sessão revogada/expirada, conta
 * inativa ou excluída invalidam o acesso imediatamente (restrição contextual 7).
 */
@Injectable()
export class PrincipalLoader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig
  ) {}

  async fromAccessToken(token: string, now: Date = new Date()): Promise<Principal | null> {
    const claims = verifyAccessToken(token, this.config.values.accessTokenSecret);

    if (claims === null) {
      return null;
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: claims.sid },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            deletedAt: true,
            userRoles: {
              where: {
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                role: { deletedAt: null }
              },
              select: {
                role: {
                  select: {
                    code: true,
                    rolePermissions: {
                      where: { permission: { deletedAt: null } },
                      select: { permission: { select: { code: true } } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (
      session === null ||
      session.userId !== claims.sub ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      session.user.status !== 'ACTIVE' ||
      session.user.deletedAt !== null
    ) {
      return null;
    }

    const roles = session.user.userRoles.map((userRole) => userRole.role.code);
    const permissions = new Set(
      session.user.userRoles.flatMap((userRole) =>
        userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.code)
      )
    );

    return {
      userId: session.user.id,
      sessionId: claims.sid,
      name: session.user.name,
      email: session.user.email,
      roles,
      permissions
    };
  }
}
