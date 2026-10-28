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
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CourierKind } from '../../../generated/prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength
} from 'class-validator';

import { DeleteReasonDto } from '../../../common/http/delete-reason.dto';
import {
  CurrentPrincipal,
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
  type AttemptView,
  type CourierLinkView,
  type CourierView,
  DeliveryDispatchService
} from '../application/delivery-dispatch.service';
import type { OrderView } from '../application/orders.service';
import { GuestLookupDto } from './store.dto';

const CODE = /^\d{4}$/;
const CODE_MSG = { message: 'O código tem 4 números.' };

class CourierDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty({ enum: CourierKind }) @IsEnum(CourierKind) kind!: CourierKind;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional({ example: 'Moto vermelha' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  vehicle?: string;
  @ApiPropertyOptional({ example: 'ABC1D23' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  plate?: string;
}

class UpdateCourierDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @ApiPropertyOptional({ enum: CourierKind }) @IsOptional() @IsEnum(CourierKind) kind?: CourierKind;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) vehicle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) plate?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

/** Saída para entrega: entregador cadastrado ou digitado; tudo opcional (RN-ENT-005). */
class DispatchDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() courierId?: string;
  @ApiPropertyOptional({ enum: CourierKind })
  @IsOptional()
  @IsEnum(CourierKind)
  courierKind?: CourierKind;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) courierName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) courierPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) vehicle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) plate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

class CodeDto {
  @ApiProperty({ example: '4821' }) @Matches(CODE, CODE_MSG) code!: string;
}

class ReceivedByDto {
  @ApiPropertyOptional({ description: 'Quem recebeu (ex.: "Maria, mãe").' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  receivedBy?: string;
}

class NotReceivedDto {
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(1000) note!: string;
}

class GuestNotReceivedDto extends GuestLookupDto {
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(1000) note!: string;
}

class ResolveNotReceivedDto {
  @ApiProperty({ enum: ['REDELIVER', 'REFUND', 'KEEP'] })
  @IsIn(['REDELIVER', 'REFUND', 'KEEP'])
  action!: 'REDELIVER' | 'REFUND' | 'KEEP';
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
}

class SwitchToPickupDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
  @ApiProperty() @IsBoolean() refundFee!: boolean;
}

/** Comprovante de entrega no painel: entregadores, saída, código, foto e "Não recebi". */
@ApiTags('Entrega')
@ApiBearerAuth()
@Controller('store')
export class DispatchAdminController {
  constructor(private readonly dispatch: DeliveryDispatchService) {}

  @Get('couriers')
  @RequirePermissions(PERMISSIONS.ordersStatusChange)
  couriers(): Promise<CourierView[]> {
    return this.dispatch.couriers();
  }

  @Post('couriers')
  @RequirePermissions(PERMISSIONS.deliveryManage)
  createCourier(
    @CurrentPrincipal() actor: Principal,
    @Body() body: CourierDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CourierView> {
    return this.dispatch.createCourier(actor, body, meta);
  }

  @Patch('couriers/:id')
  @RequirePermissions(PERMISSIONS.deliveryManage)
  updateCourier(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateCourierDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CourierView> {
    return this.dispatch.updateCourier(actor, id, defined(body), meta);
  }

  @Delete('couriers/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.deliveryManage)
  async deleteCourier(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DeleteReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.dispatch.deleteCourier(actor, id, body.reason, meta);
  }

  @Get('orders/:id/delivery-attempts')
  @RequirePermissions(PERMISSIONS.ordersRead)
  attempts(@Param('id', new ParseUUIDPipe()) id: string): Promise<AttemptView[]> {
    return this.dispatch.attempts(id);
  }

  @Post('orders/:id/dispatch')
  @RequirePermissions(PERMISSIONS.ordersStatusChange)
  dispatchOrder(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DispatchDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<{ link: string; attempts: AttemptView[] }> {
    return this.dispatch.dispatch(actor, id, defined(body), meta);
  }

  @Post('orders/:id/dispatch/link')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ordersStatusChange)
  rotateLink(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<{ link: string }> {
    return this.dispatch.rotateLink(actor, id, meta);
  }

  @Post('orders/:id/delivery-code')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ordersStatusChange)
  staffCode(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CodeDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<OrderView> {
    return this.dispatch.staffCode(actor, id, body.code, meta);
  }

  @Post('orders/:id/delivery-photo')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ordersStatusChange)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  staffPhoto(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: IncomingFile | undefined,
    @Body() body: ReceivedByDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<OrderView> {
    return this.dispatch.staffPhoto(actor, id, file, body.receivedBy ?? null, meta);
  }

  @Post('orders/:id/not-received/resolve')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ordersStatusChange)
  resolve(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ResolveNotReceivedDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<OrderView> {
    return this.dispatch.resolveNotReceived(actor, id, body.action, body.reason, meta);
  }

  @Post('orders/:id/switch-to-pickup')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ordersStatusChange)
  switchToPickup(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SwitchToPickupDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<OrderView> {
    return this.dispatch.switchToPickup(actor, id, body, meta);
  }
}

/** Link do entregador (sem login) e "Não recebi" do comprador (RN-ENT-006/007). */
@ApiTags('Entrega')
@Controller()
export class DispatchPublicController {
  constructor(private readonly dispatch: DeliveryDispatchService) {}

  @Public()
  @Get('public/deliveries/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  link(@Param('token') token: string): Promise<CourierLinkView> {
    return this.dispatch.linkView(token);
  }

  @Public()
  @Post('public/deliveries/:token/code')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  linkCode(@Param('token') token: string, @Body() body: CodeDto): Promise<CourierLinkView> {
    return this.dispatch.linkCode(token, body.code);
  }

  @Public()
  @Post('public/deliveries/:token/photo')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  linkPhoto(
    @Param('token') token: string,
    @UploadedFile() file: IncomingFile | undefined,
    @Body() body: ReceivedByDto
  ): Promise<CourierLinkView> {
    return this.dispatch.linkPhoto(token, file, body.receivedBy ?? null);
  }

  @Post('me/orders/:id/not-received')
  @HttpCode(204)
  @ApiBearerAuth()
  async notReceived(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: NotReceivedDto
  ): Promise<void> {
    await this.dispatch.notReceived({ userId: principal.userId }, body.note, id);
  }

  @Public()
  @Post('public/orders/not-received')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async guestNotReceived(@Body() body: GuestNotReceivedDto): Promise<void> {
    await this.dispatch.notReceived({ orderNumber: body.orderNumber, code: body.code }, body.note);
  }
}
