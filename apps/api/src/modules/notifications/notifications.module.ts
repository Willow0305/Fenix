import { Global, Module } from '@nestjs/common';

import { DeliveryService } from './application/delivery.service';
import { NotificationsService } from './application/notifications.service';
import { PreferencesService } from './application/preferences.service';
import { DeliveriesController, NotificationsController } from './http/notifications.controller';

@Global()
@Module({
  controllers: [NotificationsController, DeliveriesController],
  providers: [NotificationsService, DeliveryService, PreferencesService],
  exports: [NotificationsService, DeliveryService]
})
export class NotificationsModule {}
