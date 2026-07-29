import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AUDIT_ACTIONS } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import type { RequestWithPrincipal } from '../common/http/request-with-principal';
import type { PermissionCode } from './access.constants';
import { IS_PUBLIC_KEY, REQUIRED_PERMISSIONS_KEY } from './access.decorators';

@Injectable()
export class PermissionsGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions =
      this.reflector.getAllAndOverride<readonly PermissionCode[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const principal = request.principal;
    const mfaAllowsAccess =
      principal !== undefined &&
      (requiredPermissions.length === 0 ||
        !principal.mfaEnrollmentRequired ||
        principal.mfaVerified);
    const allowed =
      mfaAllowsAccess &&
      requiredPermissions.every((permission) => principal.permissions.includes(permission));

    if (!allowed) {
      const denialReason =
        principal?.mfaEnrollmentRequired && !principal.mfaVerified
          ? 'MFA_ENROLLMENT_REQUIRED'
          : 'MISSING_PERMISSION';

      await this.audit.record({
        action: AUDIT_ACTIONS.accessDenied,
        ...(principal ? { actorUserId: principal.userId } : {}),
        entityType: 'ProtectedRoute',
        reason: denialReason,
        metadata: {
          method: request.method,
          route: request.route?.path ?? request.path,
          requiredPermissions: [...requiredPermissions]
        },
        request
      });
      throw new ForbiddenException({
        code:
          denialReason === 'MFA_ENROLLMENT_REQUIRED' ? 'MFA_ENROLLMENT_REQUIRED' : 'ACCESS_DENIED',
        message:
          denialReason === 'MFA_ENROLLMENT_REQUIRED'
            ? 'Configure o MFA para acessar funções administrativas.'
            : 'Você não possui permissão para realizar esta ação.'
      });
    }

    return true;
  }
}
