import { Module } from '@nestjs/common';

import { FinanceModule } from '../finance/finance.module';
import { SettingsModule } from '../settings/settings.module';
import { ReviewsService } from './application/reviews.service';
import { CartService, FavoritesService } from './application/cart.service';
import { CatalogService } from './application/catalog.service';
import { CouponsService } from './application/coupons.service';
import { InventoryService } from './application/inventory.service';
import { OrdersService } from './application/orders.service';
import { OrderReader } from './application/order-view';
import { OrderCheckoutService } from './application/order-checkout.service';
import { OrderPaymentsService } from './application/order-payments.service';
import { OrderStatusService } from './application/order-status.service';
import { GuestOrderAccessService } from './application/guest-order-access.service';
import { StoreAdminController, StorefrontController } from './http/store.controller';
import { MemberCardsModule } from '../member-cards/http/cards.controller';
import { ReturnsService } from './application/returns.service';
import { DeliveryService } from './application/delivery.service';
import { DeliveryDispatchService } from './application/delivery-dispatch.service';
import { GuestMessagesService } from './application/guest-messages.service';
import { DispatchAdminController, DispatchPublicController } from './http/dispatch.controller';
import { DeliveryAdminController, DeliveryController } from './http/delivery.controller';

@Module({
  imports: [FinanceModule, SettingsModule, MemberCardsModule],
  controllers: [
    StorefrontController,
    StoreAdminController,
    DeliveryController,
    DeliveryAdminController,
    DispatchAdminController,
    DispatchPublicController
  ],
  providers: [
    CatalogService,
    InventoryService,
    CartService,
    FavoritesService,
    OrdersService,
    OrderReader,
    OrderCheckoutService,
    OrderPaymentsService,
    OrderStatusService,
    GuestOrderAccessService,
    CouponsService,
    ReturnsService,
    DeliveryService,
    DeliveryDispatchService,
    ReviewsService,
    GuestMessagesService
  ],
  exports: [OrdersService, InventoryService, CatalogService, GuestMessagesService]
})
export class StoreModule {}
