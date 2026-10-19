import { Global, Module } from '@nestjs/common';

import { NotificationsService } from './application/notifications.service';
import { NotificationsController } from './http/notifications.controller';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService]
})
export class NotificationsModule {}
