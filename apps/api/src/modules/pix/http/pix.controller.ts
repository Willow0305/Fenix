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
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

import { DeleteReasonDto } from '../../../common/http/delete-reason.dto';
import {
  CurrentPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { Public, RequirePermissions } from '../../auth/http/auth.decorators';
import { FinanceModule } from '../../finance/finance.module';
import { StoreModule } from '../../store/store.module';
import { type PixAdminView, type PixChargeView, PixService } from '../application/pix.service';

class GuestOrderDto {
  @ApiProperty()
  @IsString()
  @Matches(/^FNX-\d{6}-[A-Z0-9]{6}$/i, { message: 'Número de pedido inválido.' })
  orderNumber!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(64) code!: string;
}

class PixAccountDto {
  @ApiProperty() @IsUUID() accountId!: string;
}

/** PIX automático (DT-071): QR do pedido e da mensalidade, situação e aviso do intermediário. */
@ApiTags('PIX automático')
@Controller()
export class PixController {
  constructor(private readonly pix: PixService) {}

  /** As telas mostram o botão "Pagar com PIX" só quando está ligado. */
  @Get('public/pix')
  @Public()
  available(): { enabled: boolean; simulated: boolean } {
    return this.pix.availability();
  }

  @Post('me/orders/:id/pix')
  @ApiBearerAuth()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  forOrder(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<PixChargeView> {
    return this.pix.forOrder({ userId: principal.userId }, id);
  }

  @Post('me/monthly-fees/:id/pix')
  @ApiBearerAuth()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  forFee(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<PixChargeView> {
    return this.pix.forFee(principal.userId, id);
  }

  @Get('me/pix/:chargeId')
  @ApiBearerAuth()
  status(
    @CurrentPrincipal() principal: Principal,
    @Param('chargeId', new ParseUUIDPipe()) chargeId: string
  ): Promise<PixChargeView> {
    return this.pix.status({ userId: principal.userId }, chargeId);
  }

  @Post('me/pix/:chargeId/simulate')
  @ApiBearerAuth()
  @HttpCode(200)
  simulate(
    @CurrentPrincipal() principal: Principal,
    @Param('chargeId', new ParseUUIDPipe()) chargeId: string
  ): Promise<PixChargeView> {
    return this.pix.simulatePay({ userId: principal.userId }, chargeId);
  }

  /** Visitante: pelo número e código do pedido. */
  @Post('public/orders/pix')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  guestForOrder(@Body() body: GuestOrderDto): Promise<PixChargeView> {
    return this.pix.forOrder({ orderNumber: body.orderNumber, code: body.code });
  }

  @Post('public/pix/:chargeId/status')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  guestStatus(
    @Param('chargeId', new ParseUUIDPipe()) chargeId: string,
    @Body() body: GuestOrderDto
  ): Promise<PixChargeView> {
    return this.pix.status({ orderNumber: body.orderNumber, code: body.code }, chargeId);
  }

  @Post('public/pix/:chargeId/simulate')
  @Public()
  @HttpCode(200)
  guestSimulate(
    @Param('chargeId', new ParseUUIDPipe()) chargeId: string,
    @Body() body: GuestOrderDto
  ): Promise<PixChargeView> {
    return this.pix.simulatePay({ orderNumber: body.orderNumber, code: body.code }, chargeId);
  }

  /** Aviso do intermediário: assinatura conferida; a situação é buscada no próprio intermediário. */
  @Post('payments/pix/webhook/:provider')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  webhook(
    @Param('provider') provider: string,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Query('data.id') dataId: string | undefined
  ): Promise<{ received: true }> {
    return this.pix.webhook(provider, { signature, requestId, dataId });
  }

  @Get('payments/pix')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.paymentsConfirm)
  admin(): Promise<PixAdminView> {
    return this.pix.admin();
  }

  @Put('payments/pix/account')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.financeSetup)
  setAccount(
    @CurrentPrincipal() actor: Principal,
    @Body() body: PixAccountDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<PixAdminView> {
    return this.pix.setAccount(actor, body.accountId, meta);
  }

  @Post('payments/pix/:chargeId/resolve')
  @ApiBearerAuth()
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.paymentsCorrect)
  resolve(
    @CurrentPrincipal() actor: Principal,
    @Param('chargeId', new ParseUUIDPipe()) chargeId: string,
    @Body() body: DeleteReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<PixAdminView> {
    return this.pix.resolveReview(actor, chargeId, body.reason, meta);
  }
}

@Module({
  imports: [StoreModule, FinanceModule],
  controllers: [PixController],
  providers: [PixService]
})
export class PixModule {}
