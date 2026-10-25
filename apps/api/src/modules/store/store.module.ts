import { Module } from '@nestjs/common';

import { FinanceModule } from '../finance/finance.module';
import { SettingsModule } from '../settings/settings.module';
import { CartService, FavoritesService } from './application/cart.service';
import { CatalogService } from './application/catalog.service';
import { CouponsService } from './application/coupons.service';
import { InventoryService } from './application/inventory.service';
import { OrdersService } from './application/orders.service';
import { StoreAdminController, StorefrontController } from './http/store.controller';

@Module({
  imports: [FinanceModule, SettingsModule],
  controllers: [StorefrontController, StoreAdminController],
  providers: [
    CatalogService,
    InventoryService,
    CartService,
    FavoritesService,
    OrdersService,
    CouponsService
  ],
  exports: [OrdersService, InventoryService, CatalogService]
})
export class StoreModule {}
