import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';

import { AppConfig } from '../../../common/config/app-config';
import { type Money, parseMoney } from '../../../common/domain/money';
import { IdempotencyKey } from '../../../common/http/idempotency';
import type { Page } from '../../../common/http/pagination';
import {
  type ContextRequest,
  CurrentPrincipal,
  OptionalPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import { defined } from '../../../common/util/defined';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { Public, RequirePermissions } from '../../auth/http/auth.decorators';
import type { IncomingFile } from '../../media/application/media.service';
import { UPLOAD_LIMITS } from '../../settings/http/settings.controller';
import {
  type CartOwner,
  CartService,
  type CartView,
  FavoritesService
} from '../application/cart.service';
import {
  CatalogService,
  type ProductCategoryView,
  type ProductDetail,
  type ProductSummary
} from '../application/catalog.service';
import {
  InventoryService,
  type MovementView,
  type StockLevel
} from '../application/inventory.service';
import { OrdersService, type OrderView } from '../application/orders.service';
import {
  AccountBodyDto,
  AdminProductQueryDto,
  CartItemDto,
  CheckoutDto,
  GuestLookupDto,
  GuestProofDto,
  ImageBodyDto,
  OrderPaymentDto,
  OrderProofDto,
  OrderQueryDto,
  OrderStatusDto,
  ProductDto,
  ProductStatusDto,
  PublicProductQueryDto,
  StockAdjustDto,
  StoreCategoryDto,
  UpdateProductDto,
  UpdateStoreCategoryDto,
  UpdateVariantDto,
  VariantDto
} from './store.dto';

export const CART_COOKIE = 'fenix_cart';
const IDEMPOTENCY_HEADER = { name: 'Idempotency-Key', required: true };

/** '' remove o valor; ausente mantém; demais são validados como dinheiro. */
function optionalMoney(value: string | undefined, field: string): Money | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value === '' ? null : parseMoney(value, field);
}

function sendFile(
  res: Response,
  file: { content: Buffer; mimeType: string; fileName: string }
): void {
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
  );
  res.send(file.content);
}

@ApiTags('store')
@Controller()
export class StorefrontController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly carts: CartService,
    private readonly orders: OrdersService,
    private readonly favorites: FavoritesService,
    private readonly config: AppConfig
  ) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.values.isProduction,
      sameSite: 'lax',
      path: '/api/v1',
      maxAge: 30 * 86_400_000
    };
  }

  private owner(req: ContextRequest, principal: Principal | undefined): CartOwner {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[CART_COOKIE];

    return {
      principal,
      guestToken: typeof token === 'string' && token.length > 10 ? token : undefined
    };
  }

  @Get('public/product-categories')
  @Public()
  categories(): Promise<ProductCategoryView[]> {
    return this.catalog.categories(false);
  }

  @Get('public/products')
  @Public()
  products(@Query() query: PublicProductQueryDto): Promise<Page<ProductSummary>> {
    return this.catalog.publicList(query);
  }

  @Get('public/products/:slug')
  @Public()
  product(@Param('slug') slug: string): Promise<ProductDetail> {
    return this.catalog.publicDetail(slug);
  }

  @Get('cart')
  @Public()
  async cart(
    @Req() req: ContextRequest,
    @OptionalPrincipal() principal: Principal | undefined,
    @Res({ passthrough: true }) res: Response
  ): Promise<CartView> {
    const owner = this.owner(req, principal);

    if (principal && owner.guestToken) {
      await this.carts.mergeGuest(principal, owner.guestToken);
      res.clearCookie(CART_COOKIE, this.cookieOptions());
    }

    return this.carts.view(principal ? { principal } : owner);
  }

  @Put('cart/items')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async setItem(
    @Req() req: ContextRequest,
    @OptionalPrincipal() principal: Principal | undefined,
    @Body() body: CartItemDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<CartView> {
    const result = await this.carts.setItem(
      this.owner(req, principal),
      body.variantId,
      body.quantity
    );

    if (result.newGuestToken) {
      res.cookie(CART_COOKIE, result.newGuestToken, this.cookieOptions());
    }

    return result.view;
  }

  @Post('orders/checkout')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async checkout(
    @Req() req: ContextRequest,
    @OptionalPrincipal() principal: Principal | undefined,
    @Body() body: CheckoutDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<{ order: OrderView; guestAccessCode: string | null }> {
    const input: Partial<CheckoutDto> = { ...body };

    delete input.acceptTerms;

    return this.orders.checkout(this.owner(req, principal), defined(input), meta);
  }

  @Post('public/orders/lookup')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  lookup(@Body() body: GuestLookupDto): Promise<OrderView> {
    return this.orders.guestLookup(body.orderNumber, body.code);
  }

  @Post('public/orders/proof')
  @Public()
  @ApiHeader(IDEMPOTENCY_HEADER)
  @ApiConsumes('multipart/form-data')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  async guestProof(
    @Body() body: GuestProofDto,
    @UploadedFile() file: IncomingFile | undefined,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<OrderView> {
    const order = await this.orders.guestLookup(body.orderNumber, body.code);

    return this.orders.submitProof(
      { id: order.id, userId: null },
      defined({ paidOn: body.paidOn, notes: body.notes }),
      file,
      key,
      meta
    );
  }

  @Get('me/orders')
  @ApiBearerAuth()
  myOrders(@CurrentPrincipal() principal: Principal): Promise<OrderView[]> {
    return this.orders.mine(principal.userId);
  }

  @Get('me/orders/:id')
  @ApiBearerAuth()
  myOrder(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<OrderView> {
    return this.orders.getOwn(principal.userId, id);
  }

  @Post('me/orders/:id/proof')
  @ApiBearerAuth()
  @ApiHeader(IDEMPOTENCY_HEADER)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  async myProof(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: OrderProofDto,
    @UploadedFile() file: IncomingFile | undefined,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<OrderView> {
    await this.orders.getOwn(principal.userId, id);

    return this.orders.submitProof(
      { id, userId: principal.userId },
      defined(body),
      file,
      key,
      meta
    );
  }

  @Get('me/favorites')
  @ApiBearerAuth()
  myFavorites(@CurrentPrincipal() principal: Principal): ReturnType<FavoritesService['list']> {
    return this.favorites.list(principal.userId);
  }

  @Put('me/favorites/:productId')
  @ApiBearerAuth()
  @HttpCode(204)
  async favorite(
    @CurrentPrincipal() principal: Principal,
    @Param('productId', new ParseUUIDPipe()) productId: string
  ): Promise<void> {
    await this.favorites.add(principal.userId, productId);
  }

  @Delete('me/favorites/:productId')
  @ApiBearerAuth()
  @HttpCode(204)
  async unfavorite(
    @CurrentPrincipal() principal: Principal,
    @Param('productId', new ParseUUIDPipe()) productId: string
  ): Promise<void> {
    await this.favorites.remove(principal.userId, productId);
  }
}

@ApiTags('store-admin')
@ApiBearerAuth()
@Controller('store')
export class StoreAdminController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly inventory: InventoryService,
    private readonly orders: OrdersService
  ) {}

  @Get('categories')
  @RequirePermissions(PERMISSIONS.productsManage)
  categories(): Promise<ProductCategoryView[]> {
    return this.catalog.categories(true);
  }

  @Post('categories')
  @RequirePermissions(PERMISSIONS.productsManage)
  createCategory(
    @CurrentPrincipal() actor: Principal,
    @Body() body: StoreCategoryDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ProductCategoryView> {
    return this.catalog.createCategory(actor, defined(body), meta);
  }

  @Patch('categories/:id')
  @RequirePermissions(PERMISSIONS.productsManage)
  updateCategory(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateStoreCategoryDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ProductCategoryView> {
    return this.catalog.updateCategory(actor, id, defined(body), meta);
  }

  @Get('products')
  @RequirePermissions(PERMISSIONS.productsManage)
  products(@Query() query: AdminProductQueryDto): Promise<Page<ProductSummary>> {
    return this.catalog.adminList(query);
  }

  @Get('products/:id')
  @RequirePermissions(PERMISSIONS.productsManage)
  product(@Param('id', new ParseUUIDPipe()) id: string): Promise<ProductDetail> {
    return this.catalog.adminDetail(id);
  }

  @Post('products')
  @RequirePermissions(PERMISSIONS.productsManage)
  create(
    @CurrentPrincipal() actor: Principal,
    @Body() body: ProductDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ProductDetail> {
    const { basePrice, promotionalPrice, costPrice, ...rest } = body;

    return this.catalog.create(
      actor,
      {
        ...defined(rest),
        basePrice: parseMoney(basePrice, 'basePrice'),
        ...(promotionalPrice === undefined
          ? {}
          : { promotionalPrice: parseMoney(promotionalPrice, 'promotionalPrice') }),
        ...(costPrice === undefined
          ? {}
          : { costPrice: parseMoney(costPrice, 'costPrice', { allowZero: true }) })
      },
      meta
    );
  }

  @Patch('products/:id')
  @RequirePermissions(PERMISSIONS.productsManage)
  update(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateProductDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ProductDetail> {
    const { basePrice, promotionalPrice, costPrice, buyerLimit, ...rest } = body;
    const promo = optionalMoney(promotionalPrice, 'promotionalPrice');
    const cost = optionalMoney(costPrice, 'costPrice');

    return this.catalog.update(
      actor,
      id,
      {
        ...defined(rest),
        ...(basePrice === undefined ? {} : { basePrice: parseMoney(basePrice, 'basePrice') }),
        ...(promo === undefined ? {} : { promotionalPrice: promo }),
        ...(cost === undefined ? {} : { costPrice: cost }),
        ...(buyerLimit === undefined ? {} : { buyerLimit: buyerLimit === 0 ? null : buyerLimit })
      },
      meta
    );
  }

  @Put('products/:id/status')
  @RequirePermissions(PERMISSIONS.productsManage)
  status(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ProductStatusDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ProductDetail> {
    return this.catalog.setStatus(actor, id, body.status, body.reason ?? null, meta);
  }

  @Post('products/:id/variants')
  @RequirePermissions(PERMISSIONS.productsManage)
  addVariant(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: VariantDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ProductDetail> {
    const { priceOverride, promotionalPriceOverride, ...rest } = body;

    return this.catalog.addVariant(
      actor,
      id,
      {
        ...defined(rest),
        ...(priceOverride === undefined
          ? {}
          : { priceOverride: parseMoney(priceOverride, 'priceOverride') }),
        ...(promotionalPriceOverride === undefined
          ? {}
          : {
              promotionalPriceOverride: parseMoney(
                promotionalPriceOverride,
                'promotionalPriceOverride'
              )
            })
      },
      meta
    );
  }

  @Patch('products/:id/variants/:variantId')
  @RequirePermissions(PERMISSIONS.productsManage)
  updateVariant(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @Body() body: UpdateVariantDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ProductDetail> {
    const { priceOverride, promotionalPriceOverride, ...rest } = body;
    const price = optionalMoney(priceOverride, 'priceOverride');
    const promo = optionalMoney(promotionalPriceOverride, 'promotionalPriceOverride');

    return this.catalog.updateVariant(
      actor,
      id,
      variantId,
      {
        ...defined(rest),
        ...(price === undefined ? {} : { priceOverride: price }),
        ...(promo === undefined ? {} : { promotionalPriceOverride: promo })
      },
      meta
    );
  }

  @Post('products/:id/images')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(PERMISSIONS.productsManage)
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  addImage(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: IncomingFile | undefined,
    @Body() body: ImageBodyDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ProductDetail> {
    return this.catalog.addImage(actor, id, file, body.altText?.trim() || null, meta);
  }

  @Delete('products/:id/images/:imageId')
  @RequirePermissions(PERMISSIONS.productsManage)
  removeImage(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<ProductDetail> {
    return this.catalog.removeImage(actor, id, imageId, meta);
  }

  @Post('variants/:variantId/stock')
  @RequirePermissions(PERMISSIONS.inventoryAdjust)
  adjust(
    @CurrentPrincipal() actor: Principal,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @Body() body: StockAdjustDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<StockLevel> {
    return this.inventory.adjust(actor, variantId, body, meta);
  }

  @Get('variants/:variantId/movements')
  @RequirePermissions(PERMISSIONS.productsManage)
  movements(@Param('variantId', new ParseUUIDPipe()) variantId: string): Promise<MovementView[]> {
    return this.inventory.movements(variantId);
  }

  @Get('orders')
  @RequirePermissions(PERMISSIONS.ordersRead)
  orderList(@Query() query: OrderQueryDto): Promise<Page<OrderView>> {
    return this.orders.list(query);
  }

  @Get('orders/:id')
  @RequirePermissions(PERMISSIONS.ordersRead)
  order(@Param('id', new ParseUUIDPipe()) id: string): Promise<OrderView> {
    return this.orders.get(id);
  }

  @Post('orders/:id/payments')
  @ApiHeader(IDEMPOTENCY_HEADER)
  @RequirePermissions(PERMISSIONS.ordersStatusChange, PERMISSIONS.paymentsRecord)
  recordPayment(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: OrderPaymentDto,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<OrderView> {
    return this.orders.recordPayment(actor, id, defined(body), key, meta);
  }

  @Post('orders/:id/payments/:paymentId/confirm')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.paymentsConfirm)
  confirm(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() body: AccountBodyDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<OrderView> {
    return this.orders.confirmPayment(actor, id, paymentId, body.accountId, meta);
  }

  @Get('orders/:id/payments/:paymentId/attachments/:attachmentId')
  @RequirePermissions(PERMISSIONS.ordersRead)
  async attachment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
    @Res() res: Response
  ): Promise<void> {
    sendFile(res, await this.orders.paymentAttachmentForOrder(id, paymentId, attachmentId));
  }

  @Put('orders/:id/status')
  @RequirePermissions(PERMISSIONS.ordersStatusChange)
  changeStatus(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: OrderStatusDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<OrderView> {
    return this.orders.changeStatus(
      actor,
      id,
      body.status,
      defined({ reason: body.reason, restock: body.restock }),
      meta
    );
  }

  @Post('orders/expire-reservations')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ordersStatusChange)
  async expire(): Promise<{ expired: number }> {
    return { expired: await this.orders.expireStale() };
  }
}
