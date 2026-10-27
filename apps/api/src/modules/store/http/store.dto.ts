import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CommissionType,
  CouponAudience,
  CouponDiscountType,
  CouponScope,
  Gender,
  OrderStatus,
  ProductFulfillmentType,
  ProductStatus
} from '../../../generated/prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
  MinLength,
  ValidateIf,
  ValidateNested
} from 'class-validator';

import { IsMobilePhoneBr } from '../../../common/validation/br-fields';
import { PageQueryDto } from '../../../common/http/pagination';

const AMOUNT = /^\d{1,13}(\.\d{1,2})?$/;
const AMOUNT_MSG = { message: 'Valor inválido: use ponto e até 2 casas (ex.: 89.90).' };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MSG = { message: 'Data inválida (AAAA-MM-DD).' };
const PERCENT = /^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/;
const PERCENT_MSG = { message: 'Percentual inválido: de 0 a 100, até 2 casas.' };

/** Comissão própria do produto (PEN-035); tipo vazio volta a usar a regra do parceiro. */
export class ProductCommissionFields {
  @ApiPropertyOptional({ enum: [...Object.values(CommissionType), ''] })
  @IsOptional()
  @IsIn([...Object.values(CommissionType), ''])
  commissionTypeOverride?: CommissionType | '';
  @ApiPropertyOptional({ example: '15' })
  @IsOptional()
  @Matches(PERCENT, PERCENT_MSG)
  commissionPercentageOverride?: string;
  @ApiPropertyOptional({ example: '5.00' })
  @IsOptional()
  @Matches(AMOUNT, AMOUNT_MSG)
  commissionFixedOverride?: string;
}

export class StoreCategoryDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
}

export class UpdateStoreCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ProductDto extends ProductCommissionFields {
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
  @ApiPropertyOptional({ description: 'Afiliação: validade em meses (DT-068).' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  membershipMonths?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) pickupInstructions?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() partnerId?: string;
}

export class UpdateProductDto extends ProductCommissionFields {
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
  @ApiPropertyOptional({ description: 'Afiliação: validade em meses (DT-068).' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  membershipMonths?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) pickupInstructions?: string;
  @ApiPropertyOptional({ description: 'String vazia remove o vínculo com o parceiro.' })
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsUUID()
  partnerId?: string;
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

export class ImageOrderDto {
  @ApiProperty({
    type: [String],
    description: 'Todas as fotos do produto na nova ordem; a primeira é a capa.'
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsUUID('all', { each: true })
  imageIds!: string[];
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
  @ApiPropertyOptional({ description: 'Somente produtos em pré-venda (remessa aberta).' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  campaign?: boolean;
  @ApiPropertyOptional({ description: 'Somente afiliações à venda (DT-068).' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  membership?: boolean;
}

export class BeneficiaryDto {
  @ApiProperty() @IsString() @MaxLength(160) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(180) email?: string;
  @ApiPropertyOptional({ description: 'Carteirinha de afiliado a renovar.' })
  @IsOptional()
  @IsUUID()
  cardId?: string;
}

export class BeneficiariesDto {
  @ApiProperty({ type: [BeneficiaryDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BeneficiaryDto)
  beneficiaries!: BeneficiaryDto[];
}

export class CartItemDto {
  @ApiProperty() @IsUUID() variantId!: string;
  @ApiProperty({ minimum: 0, maximum: 50 }) @IsInt() @Min(0) @Max(50) quantity!: number;
}

export class CartChangeDto {
  @ApiProperty() @IsUUID() fromVariantId!: string;
  @ApiProperty() @IsUUID() toVariantId!: string;
  @ApiProperty({ minimum: 1, maximum: 50 }) @IsInt() @Min(1) @Max(50) quantity!: number;
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
  @IsMobilePhoneBr()
  customerPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiPropertyOptional({ description: 'Cupom de desconto (DT-045).' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;
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

const PERCENT_2 = /^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/;

/** Cupom de desconto (DT-045). Valores em texto com ponto: "10" ou "15.50". */
export class CouponDto {
  @ApiProperty({ example: 'FENIX10' }) @IsString() @MinLength(3) @MaxLength(40) code!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiProperty({ enum: CouponDiscountType })
  @IsEnum(CouponDiscountType)
  discountType!: CouponDiscountType;
  @ApiPropertyOptional({ example: '10' })
  @IsOptional()
  @Matches(PERCENT_2, { message: 'Percentual inválido: de 0,01 a 100, até 2 casas.' })
  percentage?: string;
  @ApiPropertyOptional({ example: '20.00' })
  @IsOptional()
  @Matches(AMOUNT, AMOUNT_MSG)
  amount?: string;
  @ApiProperty({ enum: CouponScope }) @IsEnum(CouponScope) scope!: CouponScope;
  @ApiProperty({ enum: CouponAudience }) @IsEnum(CouponAudience) audience!: CouponAudience;
  @ApiPropertyOptional() @IsOptional() @Matches(AMOUNT, AMOUNT_MSG) minimumOrderAmount?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() endsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100000) maxRedemptions?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(1000) maxPerCustomer?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  productIds?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  categoryIds?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  roleIds?: string[];
}

export class CouponActiveDto {
  @ApiProperty() @IsBoolean() isActive!: boolean;
}

export class CouponPreviewDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(40) code!: string;
}
