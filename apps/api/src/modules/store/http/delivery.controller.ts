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
  Put
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

import { parseMoney } from '../../../common/domain/money';
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
import {
  type AddressView,
  type DeliveryOptions,
  DeliveryService,
  type DeliveryZoneView
} from '../application/delivery.service';

const AMOUNT = /^\d{1,13}(\.\d{1,2})?$/;
const AMOUNT_MSG = { message: 'Valor inválido (use 0.00).' };

/** Endereço digitado (checkout e "Meus endereços"). */
export class AddressDto {
  @ApiProperty({ example: '69900-000' }) @IsString() @MaxLength(10) postalCode!: string;
  @ApiProperty() @IsString() @MaxLength(200) street!: string;
  @ApiProperty() @IsString() @MaxLength(20) number!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) complement?: string;
  @ApiProperty({ description: 'Bairro atendido (lista de Entrega).' })
  @IsUUID()
  neighborhoodId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) reference?: string;
  @ApiPropertyOptional({ description: 'Telefone para o entregador.' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

class SavedAddressDto extends AddressDto {
  @ApiPropertyOptional({ example: 'Casa' }) @IsOptional() @IsString() @MaxLength(60) label?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

class DeliverySettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) city?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/, { message: 'UF inválida.' })
  state?: string;
  @ApiPropertyOptional({ description: 'Frete grátis a partir deste valor; vazio desliga.' })
  @IsOptional()
  @Matches(/^(\d{1,13}(\.\d{1,2})?)?$/, AMOUNT_MSG)
  freeMinimum?: string;
}

class ZoneDto {
  @ApiProperty({ example: 'Centro' }) @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @ApiProperty({ example: '8.00' }) @Matches(AMOUNT, AMOUNT_MSG) fee!: string;
  @ApiProperty({ description: 'Prazo em dias úteis depois do pagamento.' })
  @IsInt()
  @Min(0)
  @Max(60)
  leadDays!: number;
  @ApiProperty({ type: [String], description: 'Bairros (um por item, ou separados por linha).' })
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  @MaxLength(4000, { each: true })
  neighborhoods!: string[];
}

class UpdateZoneDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(AMOUNT, AMOUNT_MSG) fee?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(60) leadDays?: number;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  @MaxLength(4000, { each: true })
  neighborhoods?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

/** Entrega em casa no site (DT-075): opções do carrinho, CEP e endereços da conta. */
@ApiTags('Entrega')
@Controller()
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Public()
  @Get('public/delivery')
  options(): Promise<DeliveryOptions> {
    return this.delivery.publicOptions();
  }

  @Public()
  @Get('public/postal-codes/:code')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async postalCode(@Param('code') code: string) {
    // Sempre um objeto: `address` nulo = CEP não encontrado ou consulta indisponível.
    return { address: await this.delivery.lookupPostalCode(code) };
  }

  @Get('me/addresses')
  @ApiBearerAuth()
  myAddresses(@CurrentPrincipal() principal: Principal): Promise<AddressView[]> {
    return this.delivery.myAddresses(principal.userId);
  }

  @Post('me/addresses')
  @ApiBearerAuth()
  addAddress(
    @CurrentPrincipal() principal: Principal,
    @Body() body: SavedAddressDto
  ): Promise<AddressView> {
    return this.delivery.addAddress(principal.userId, body);
  }

  @Put('me/addresses/:id/default')
  @ApiBearerAuth()
  setDefault(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<AddressView[]> {
    return this.delivery.setDefault(principal.userId, id);
  }

  @Delete('me/addresses/:id')
  @HttpCode(204)
  @ApiBearerAuth()
  async removeAddress(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<void> {
    await this.delivery.removeAddress(principal.userId, id);
  }
}

/** Painel → Loja → Entrega: liga/desliga, frete grátis e regiões com bairros. */
@ApiTags('Entrega')
@ApiBearerAuth()
@Controller('store/delivery')
export class DeliveryAdminController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.deliveryManage)
  get() {
    return this.delivery.adminOptions();
  }

  @Put('settings')
  @RequirePermissions(PERMISSIONS.deliveryManage)
  settings(
    @CurrentPrincipal() actor: Principal,
    @Body() body: DeliverySettingsDto,
    @ReqMeta() meta: RequestMeta
  ) {
    const { freeMinimum, ...rest } = body;

    return this.delivery.updateSettings(
      actor,
      {
        ...defined(rest),
        ...(freeMinimum === undefined
          ? {}
          : { freeMinimum: freeMinimum ? parseMoney(freeMinimum, 'freeMinimum') : null })
      },
      meta
    );
  }

  @Post('zones')
  @RequirePermissions(PERMISSIONS.deliveryManage)
  createZone(
    @CurrentPrincipal() actor: Principal,
    @Body() body: ZoneDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<DeliveryZoneView> {
    return this.delivery.createZone(
      actor,
      { ...body, fee: parseMoney(body.fee, 'fee', { allowZero: true }) },
      meta
    );
  }

  @Patch('zones/:id')
  @RequirePermissions(PERMISSIONS.deliveryManage)
  updateZone(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateZoneDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<DeliveryZoneView> {
    const { fee, ...rest } = body;

    return this.delivery.updateZone(
      actor,
      id,
      {
        ...defined(rest),
        ...(fee === undefined ? {} : { fee: parseMoney(fee, 'fee', { allowZero: true }) })
      },
      meta
    );
  }

  @Delete('zones/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.deliveryManage)
  async deleteZone(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DeleteReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.delivery.deleteZone(actor, id, body.reason, meta);
  }
}
