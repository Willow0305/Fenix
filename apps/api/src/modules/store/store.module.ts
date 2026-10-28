import { Module } from '@nestjs/common';

import { FinanceModule } from '../finance/finance.module';
import { SettingsModule } from '../settings/settings.module';
import { CartService, FavoritesService } from './application/cart.service';
import { CatalogService } from './application/catalog.service';
import { CouponsService } from './application/coupons.service';
import { InventoryService } from './application/inventory.service';
import { OrdersService } from './application/orders.service';
import { StoreAdminController, StorefrontController } from './http/store.controller';
import { CardsModule } from '../cards/http/cards.controller';
import { ReturnsService } from './application/returns.service';
import { DeliveryService } from './application/delivery.service';
import { DeliveryDispatchService } from './application/delivery-dispatch.service';
import { DispatchAdminController, DispatchPublicController } from './http/dispatch.controller';
import { DeliveryAdminController, DeliveryController } from './http/delivery.controller';

@Module({
  imports: [FinanceModule, SettingsModule, CardsModule],
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
    CouponsService,
    ReturnsService,
    DeliveryService,
    DeliveryDispatchService
  ],
  exports: [OrdersService, InventoryService, CatalogService]
})
export class StoreModule {}
