import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuditService } from '../../../common/audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import {
  type ContextRequest,
  getRequestContext,
  getRequestMeta
} from '../../../common/http/request-context';
import type { PermissionCode } from '../../access/domain/permission-catalog';
import { PrincipalLoader } from '../application/principal-loader.service';
import { IS_PUBLIC, REQUIRED_PERMISSIONS } from './auth.decorators';

/**
 * Guard global: nega por padrão. Rotas sem `@Public()` exigem access token válido;
 * `@RequirePermissions()` exige cada permissão listada.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly principals: PrincipalLoader,
    private readonly audit: AuditService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const req = context.switchToHttp().getRequest<ContextRequest>();
    const targets = [context.getHandler(), context.getClass()];
    const isPublic =
      this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, targets) === true;
    const required =
      this.reflector.getAllAndOverride<PermissionCode[] | undefined>(
        REQUIRED_PERMISSIONS,
        targets
      ) ?? [];
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    const principal = token ? await this.principals.fromAccessToken(token) : null;

    if (principal !== null) {
      getRequestContext(req).principal = principal;
    }

    if (isPublic && required.length === 0) {
      return true;
    }

    if (principal === null) {
      throw AppError.unauthorized('Sessão ausente ou expirada.');
    }

    const missing = required.filter((permission) => !principal.permissions.has(permission));

    if (missing.length > 0) {
      await this.audit.record({
        actorUserId: principal.userId,
        action: 'access.denied',
        entityType: 'route',
        metadata: { method: req.method, route: req.route?.path ?? req.path, missing },
        meta: getRequestMeta(req)
      });
      throw AppError.forbidden();
    }

    return true;
  }
}
