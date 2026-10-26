import {
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { SalesCampaignStatus } from '../../../generated/prisma/client';
import {
  IsBoolean,
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
import type { Response } from 'express';

import { parseMoney } from '../../../common/domain/money';
import {
  CurrentPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import { defined } from '../../../common/util/defined';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { Public, RequirePermissions } from '../../auth/http/auth.decorators';
import { StoreModule } from '../../store/store.module';
import {
  type CampaignReport,
  CampaignsService,
  type CampaignView
} from '../application/campaigns.service';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MSG = { message: 'Data inválida (AAAA-MM-DD).' };

export class CampaignDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(160) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiProperty() @IsISO8601() salesStartAt!: string;
  @ApiProperty() @IsISO8601() salesEndAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100000) minimumQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100000) maximumQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) expectedArrivalOn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) refundPolicy?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() supplierPartnerId?: string;
}

export class UpdateCampaignDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(160) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() salesStartAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() salesEndAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100000) minimumQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100000) maximumQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) expectedArrivalOn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) refundPolicy?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() supplierPartnerId?: string;
}

export class CampaignProductDto {
  @ApiProperty() @IsUUID() productId!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{1,13}(\.\d{1,2})?$/, { message: 'Valor inválido.' })
  campaignPrice?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100000) minimumQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100000) maximumQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CampaignStatusDto {
  @ApiProperty({ enum: SalesCampaignStatus })
  @IsEnum(SalesCampaignStatus)
  status!: SalesCampaignStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(1000) reason?: string;
  @ApiPropertyOptional({ description: 'Novo encerramento ao reabrir.' })
  @IsOptional()
  @IsISO8601()
  salesEndAt?: string;
  @ApiPropertyOptional({ description: 'Data da etapa (encomenda, produção, recebimento).' })
  @IsOptional()
  @Matches(DATE, DATE_MSG)
  date?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) pickupStartsOn?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) pickupEndsOn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) pickupInstructions?: string;
}

export class PickupDto {
  @ApiPropertyOptional({ description: 'Quem retirou / observação.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CsvQueryDto {
  @ApiProperty({ enum: ['supplier', 'pickup'] }) @IsIn(['supplier', 'pickup']) kind!:
    'supplier' | 'pickup';
}

@ApiTags('Remessas')
@Controller()
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get('public/campaigns')
  @Public()
  publicList(): Promise<CampaignView[]> {
    return this.campaigns.list(true);
  }

  @Get('public/campaigns/:slug')
  @Public()
  publicGet(@Param('slug') slug: string): Promise<CampaignView> {
    return this.campaigns.get(slug, true);
  }

  @Get('campaigns')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.campaignsManage)
  list(): Promise<CampaignView[]> {
    return this.campaigns.list(false);
  }

  @Get('campaigns/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.campaignsManage)
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<CampaignView> {
    return this.campaigns.get(id);
  }

  @Post('campaigns')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.campaignsManage)
  create(
    @CurrentPrincipal() actor: Principal,
    @Body() body: CampaignDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CampaignView> {
    return this.campaigns.create(actor, defined(body), meta);
  }

  @Patch('campaigns/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.campaignsManage)
  update(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateCampaignDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CampaignView> {
    return this.campaigns.update(actor, id, defined(body), meta);
  }

  @Put('campaigns/:id/products')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.campaignsManage)
  setProduct(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CampaignProductDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CampaignView> {
    const { campaignPrice, ...rest } = body;

    return this.campaigns.setProduct(
      actor,
      id,
      {
        ...defined(rest),
        ...(campaignPrice === undefined
          ? {}
          : { campaignPrice: parseMoney(campaignPrice, 'campaignPrice') })
      },
      meta
    );
  }

  @Put('campaigns/:id/status')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.campaignsManage)
  status(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CampaignStatusDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CampaignView> {
    const { status, ...rest } = body;

    return this.campaigns.changeStatus(actor, id, status, defined(rest), meta);
  }

  @Get('campaigns/:id/report')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.campaignsManage)
  report(@Param('id', new ParseUUIDPipe()) id: string): Promise<CampaignReport> {
    return this.campaigns.report(id);
  }

  @Get('campaigns/:id/report.csv')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.campaignsManage)
  async csv(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: CsvQueryDto,
    @Res() res: Response
  ): Promise<void> {
    const file = await this.campaigns.reportCsv(id, query.kind);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(String.fromCharCode(0xfeff) + file.content);
  }

  @Post('campaigns/:id/orders/:orderId/pickup')
  @HttpCode(200)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.campaignsManage, PERMISSIONS.ordersStatusChange)
  pickup(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Body() body: PickupDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CampaignReport> {
    return this.campaigns.pickup(actor, id, orderId, body.note?.trim() || null, meta);
  }

  @Post('campaigns/close-expired')
  @HttpCode(200)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.campaignsManage)
  async closeExpired(): Promise<{ closed: number }> {
    return { closed: await this.campaigns.closeExpired() };
  }
}

@Module({
  imports: [StoreModule],
  controllers: [CampaignsController],
  providers: [CampaignsService]
})
export class CampaignsModule {}
