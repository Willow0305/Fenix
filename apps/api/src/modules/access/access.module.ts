import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AuditQueryService } from './application/audit-query.service';
import { RolesService } from './application/roles.service';
import { UsersAdminService } from './application/users-admin.service';
import { AuditController, RolesController, UsersController } from './http/access.controller';

@Module({
  imports: [AuthModule],
  controllers: [UsersController, RolesController, AuditController],
  providers: [UsersAdminService, RolesService, AuditQueryService]
})
export class AccessModule {}
