import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AccessControlController } from './access-control.controller';
import { AccessControlService } from './access-control.service';
import { InitialAdminService } from './initial-admin.service';

@Module({
  imports: [AuthModule],
  controllers: [AccessControlController],
  exports: [AccessControlService, InitialAdminService],
  providers: [AccessControlService, InitialAdminService]
})
export class AccessControlModule {}
