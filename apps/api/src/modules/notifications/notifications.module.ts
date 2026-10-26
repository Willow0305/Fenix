import { Global, Module } from '@nestjs/common';

import { DeliveryService } from './application/delivery.service';
import { NotificationsService } from './application/notifications.service';
import { PreferencesService } from './application/preferences.service';
import { StaffAlertsService } from './application/staff-alerts.service';
import { DeliveriesController, NotificationsController } from './http/notifications.controller';

@Global()
@Module({
  controllers: [NotificationsController, DeliveriesController],
  providers: [NotificationsService, DeliveryService, PreferencesService, StaffAlertsService],
  exports: [NotificationsService, DeliveryService, StaffAlertsService]
})
export class NotificationsModule {}
