import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';

import { DeleteReasonDto } from '../../../common/http/delete-reason.dto';
import { IdempotencyKey } from '../../../common/http/idempotency';
import {
  CurrentPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { Public, RequirePermissions } from '../../auth/http/auth.decorators';
import { StoreModule } from '../../store/store.module';
import {
  type CardAdminView,
  type CardChargeView,
  type CardCheckoutView,
  type CardPayInput,
  CardService
} from '../application/card.service';

class GuestOrderDto {
  @ApiProperty()
  @IsString()
  @Matches(/^FNX-\d{6}-[A-Z0-9]{6}$/i, { message: 'Número de pedido inválido.' })
  orderNumber!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(64) code!: string;
}

/** O que o formulário do intermediário devolve (o cartão vira um token lá). */
class CardPayDto {
  @ApiProperty() @IsString() @MinLength(6) @MaxLength(200) token!: string;
  @ApiProperty({ example: 'visa' }) @IsString() @MaxLength(40) paymentMethodId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) issuerId?: string;
  @ApiProperty() @IsInt() @Min(1) @Max(12) installments!: number;
  @ApiProperty({ enum: ['credit_card', 'debit_card'] })
  @IsIn(['credit_card', 'debit_card'])
  paymentType!: 'credit_card' | 'debit_card';
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(180) payerEmail?: string;
  @ApiPropertyOptional({ example: 'CPF' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  identificationType?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{11,14}$/) identificationNumber?: string;
}

class GuestCardPayDto extends CardPayDto {
  @ApiProperty()
  @IsString()
  @Matches(/^FNX-\d{6}-[A-Z0-9]{6}$/i, { message: 'Número de pedido inválido.' })
  orderNumber!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(64) code!: string;
}

class DifferentialPricingEntry {
  @ApiProperty() @IsInt() @Min(2) @Max(12) installments!: number;
  @ApiProperty() @IsString() @MaxLength(60) id!: string;
}

class DifferentialPricingDto {
  @ApiProperty({ type: [DifferentialPricingEntry] })
  @IsArray()
  @ArrayMaxSize(11)
  @ValidateNested({ each: true })
  @Type(() => DifferentialPricingEntry)
  entries!: DifferentialPricingEntry[];
}

class ResolveCardDto extends DeleteReasonDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() chargeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() refundId?: string;
}

function payInput(body: CardPayDto): CardPayInput {
  return {
    token: body.token,
    paymentMethodId: body.paymentMethodId,
    installments: body.installments,
    paymentType: body.paymentType,
    ...(body.issuerId ? { issuerId: body.issuerId } : {}),
    ...(body.payerEmail ? { payerEmail: body.payerEmail } : {}),
    ...(body.identificationType ? { identificationType: body.identificationType } : {}),
    ...(body.identificationNumber ? { identificationNumber: body.identificationNumber } : {})
  };
}

/** Cartão pelo site (DT-079): formulário, pagamento, situação e aviso do intermediário. */
@ApiTags('Cartão')
@Controller()
export class CardController {
  constructor(private readonly card: CardService) {}

  @Get('public/card')
  @Public()
  available(): { enabled: boolean; simulated: boolean; maxInstallments: number } {
    return this.card.availability();
  }

  @Get('me/orders/:id/card')
  @ApiBearerAuth()
  checkout(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<CardCheckoutView> {
    return this.card.checkout({ userId: principal.userId }, id);
  }

  @Post('me/orders/:id/card')
  @ApiBearerAuth()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  pay(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CardPayDto,
    @IdempotencyKey() key: string
  ): Promise<CardChargeView> {
    return this.card.pay({ userId: principal.userId }, payInput(body), key, id);
  }

  @Get('me/card/:chargeId')
  @ApiBearerAuth()
  status(
    @CurrentPrincipal() principal: Principal,
    @Param('chargeId', new ParseUUIDPipe()) chargeId: string
  ): Promise<CardChargeView> {
    return this.card.status({ userId: principal.userId }, chargeId);
  }

  /** Visitante: pelo número e código do pedido. */
  @Post('public/orders/card/checkout')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  guestCheckout(@Body() body: GuestOrderDto): Promise<CardCheckoutView> {
    return this.card.checkout({ orderNumber: body.orderNumber, code: body.code });
  }

  @Post('public/orders/card')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  guestPay(@Body() body: GuestCardPayDto, @IdempotencyKey() key: string): Promise<CardChargeView> {
    return this.card.pay({ orderNumber: body.orderNumber, code: body.code }, payInput(body), key);
  }

  @Post('public/card/:chargeId/status')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  guestStatus(
    @Param('chargeId', new ParseUUIDPipe()) chargeId: string,
    @Body() body: GuestOrderDto
  ): Promise<CardChargeView> {
    return this.card.status({ orderNumber: body.orderNumber, code: body.code }, chargeId);
  }

  /** Aviso do intermediário: assinatura conferida; a situação é buscada no próprio intermediário. */
  @Post('payments/card/webhook/:provider')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  webhook(
    @Param('provider') provider: string,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Query('data.id') dataId: string | undefined
  ): Promise<{ received: true }> {
    return this.card.webhook(provider, { signature, requestId, dataId });
  }

  @Get('payments/card')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.paymentsConfirm)
  admin(): Promise<CardAdminView> {
    return this.card.admin();
  }

  @Put('payments/card/differential-pricing')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.financeSetup)
  setDifferentialPricing(
    @CurrentPrincipal() actor: Principal,
    @Body() body: DifferentialPricingDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CardAdminView> {
    return this.card.setDifferentialPricing(actor, body.entries, meta);
  }

  @Post('payments/card/resolve')
  @ApiBearerAuth()
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.paymentsCorrect)
  resolve(
    @CurrentPrincipal() actor: Principal,
    @Body() body: ResolveCardDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CardAdminView> {
    return this.card.resolve(
      actor,
      {
        ...(body.chargeId ? { chargeId: body.chargeId } : {}),
        ...(body.refundId ? { refundId: body.refundId } : {})
      },
      body.reason,
      meta
    );
  }
}

@Module({
  imports: [StoreModule],
  controllers: [CardController],
  providers: [CardService]
})
export class CardModule {}
