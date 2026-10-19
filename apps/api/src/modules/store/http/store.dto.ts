import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, OrderStatus, ProductFulfillmentType, ProductStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

import { PageQueryDto } from '../../../common/http/pagination';

const AMOUNT = /^\d{1,13}(\.\d{1,2})?$/;
const AMOUNT_MSG = { message: 'Valor inválido: use ponto e até 2 casas (ex.: 89.90).' };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MSG = { message: 'Data inválida (AAAA-MM-DD).' };
const PHONE = /^[0-9+()\s-]{8,30}$/;

export class StoreCategoryDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
}

export class UpdateStoreCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ProductDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiProperty({ enum: ProductFulfillmentType })
  @IsEnum(ProductFulfillmentType)
  fulfillmentType!: ProductFulfillmentType;
  @ApiProperty({ example: '89.90' }) @Matches(AMOUNT, AMOUNT_MSG) basePrice!: string;
  @ApiPropertyOptional() @IsOptional() @Matches(AMOUNT, AMOUNT_MSG) promotionalPrice?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(AMOUNT, AMOUNT_MSG) costPrice?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) brand?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(1000) buyerLimit?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFeatured?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() availableFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() availableUntil?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(365) productionLeadDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) pickupInstructions?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() partnerId?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional({ enum: ProductFulfillmentType })
  @IsOptional()
  @IsEnum(ProductFulfillmentType)
  fulfillmentType?: ProductFulfillmentType;
  @ApiPropertyOptional() @IsOptional() @Matches(AMOUNT, AMOUNT_MSG) basePrice?: string;
  @ApiPropertyOptional({ description: 'String vazia remove a promoção.' })
  @IsOptional()
  @Matches(/^(\d{1,13}(\.\d{1,2})?)?$/, AMOUNT_MSG)
  promotionalPrice?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^(\d{1,13}(\.\d{1,2})?)?$/, AMOUNT_MSG)
  costPrice?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) brand?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(1000) buyerLimit?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFeatured?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() availableFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() availableUntil?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(365) productionLeadDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) pickupInstructions?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() partnerId?: string;
}

export class ProductStatusDto {
  @ApiProperty({ enum: ProductStatus }) @IsEnum(ProductStatus) status!: ProductStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class VariantDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(140) name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[A-Za-z0-9._-]{2,100}$/, { message: 'SKU inválido.' })
  sku?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) size?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) color?: string;
  @ApiPropertyOptional({ enum: Gender }) @IsOptional() @IsEnum(Gender) gender?: Gender;
  @ApiPropertyOptional() @IsOptional() @Matches(AMOUNT, AMOUNT_MSG) priceOverride?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(AMOUNT, AMOUNT_MSG)
  promotionalPriceOverride?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100000) minimumStock?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateVariantDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(140) name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[A-Za-z0-9._-]{2,100}$/, { message: 'SKU inválido.' })
  sku?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) size?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) color?: string;
  @ApiPropertyOptional({ enum: Gender }) @IsOptional() @IsEnum(Gender) gender?: Gender;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^(\d{1,13}(\.\d{1,2})?)?$/, AMOUNT_MSG)
  priceOverride?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^(\d{1,13}(\.\d{1,2})?)?$/, AMOUNT_MSG)
  promotionalPriceOverride?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100000) minimumStock?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class StockAdjustDto {
  @ApiProperty({ enum: ['STOCK_IN', 'LOSS', 'ADJUSTMENT'] })
  @IsIn(['STOCK_IN', 'LOSS', 'ADJUSTMENT'])
  type!: 'STOCK_IN' | 'LOSS' | 'ADJUSTMENT';
  @ApiProperty({ description: 'Positivo; ADJUSTMENT aceita negativo.' })
  @IsInt()
  @Min(-100000)
  @Max(100000)
  quantity!: number;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) reason!: string;
}

export class ImageBodyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(180) altText?: string;
}

export class AdminProductQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
}

export class PublicProductQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(140) category?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  featured?: boolean;
}

export class CartItemDto {
  @ApiProperty() @IsUUID() variantId!: string;
  @ApiProperty({ minimum: 0, maximum: 50 }) @IsInt() @Min(0) @Max(50) quantity!: number;
}

export class CheckoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  customerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(180) customerEmail?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(PHONE, { message: 'Telefone inválido.' })
  customerPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiProperty({ description: 'Aceite das regras da loja e da política de privacidade.' })
  @IsBoolean()
  @IsIn([true], { message: 'É necessário aceitar as regras da loja.' })
  acceptTerms!: boolean;
}

export class GuestLookupDto {
  @ApiProperty()
  @IsString()
  @Matches(/^FNX-\d{6}-[A-Z0-9]{6}$/i, { message: 'Número de pedido inválido.' })
  orderNumber!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(64) code!: string;
}

export class OrderQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) from?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) to?: string;
}

export class OrderPaymentDto {
  @ApiProperty() @IsUUID() paymentMethodId!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) paidOn!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() accountId?: string;
}

export class OrderProofDto {
  @ApiProperty() @Matches(DATE, DATE_MSG) paidOn!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class GuestProofDto extends OrderProofDto {
  @ApiProperty()
  @IsString()
  @Matches(/^FNX-\d{6}-[A-Z0-9]{6}$/i, { message: 'Número de pedido inválido.' })
  orderNumber!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(64) code!: string;
}

export class OrderStatusDto {
  @ApiProperty({ enum: OrderStatus }) @IsEnum(OrderStatus) status!: OrderStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(1000) reason?: string;
  @ApiPropertyOptional({ description: 'Devolver itens ao estoque ao cancelar/reembolsar.' })
  @IsOptional()
  @IsBoolean()
  restock?: boolean;
}

export class AccountBodyDto {
  @ApiProperty() @IsUUID() accountId!: string;
}
