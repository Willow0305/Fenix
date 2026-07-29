import { Global, Module } from '@nestjs/common';

import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Global()
@Module({
  controllers: [AuditController],
  exports: [AuditService],
  providers: [AuditService]
})
export class AuditModule {}
