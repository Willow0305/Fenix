import { SetMetadata } from '@nestjs/common';

import type { PermissionCode } from './access.constants';

export const IS_PUBLIC_KEY = 'fenix:is-public';
export const REQUIRED_PERMISSIONS_KEY = 'fenix:required-permissions';

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export const RequirePermissions = (
  ...permissions: readonly PermissionCode[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
