import { SetMetadata } from '@nestjs/common';

import type { PermissionCode } from '../../access/domain/permission-catalog';

export const IS_PUBLIC = 'fenix:isPublic';
export const REQUIRED_PERMISSIONS = 'fenix:requiredPermissions';
export const PASSIVE = 'fenix:passive';

/** Rota acessível sem autenticação. O principal, se houver token válido, ainda é resolvido. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

/**
 * Requisição feita sozinha pelo navegador, sem ação da pessoa (ex.: conexão em tempo real,
 * DT-049): não conta como uso e não adia a expiração da sessão por inatividade (DT-037).
 */
export const Passive = (): MethodDecorator & ClassDecorator => SetMetadata(PASSIVE, true);

/** Exige todas as permissões listadas, verificadas no servidor (RN-AUT-003). */
export const RequirePermissions = (
  ...permissions: PermissionCode[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_PERMISSIONS, permissions);
