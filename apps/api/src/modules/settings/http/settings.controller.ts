import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { TeamBrandContext } from '../../../generated/prisma/client';

import {
  CurrentPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { Public, RequirePermissions } from '../../auth/http/auth.decorators';
import type { IncomingFile } from '../../media/application/media.service';
import {
  type AdminTeamSettings,
  type PublicSettingsPatch,
  type PublicTeamSettings,
  SettingsService
} from '../application/settings.service';
import {
  BrandAssetBodyDto,
  ClubPhotoOrderDto,
  UpdateFinancialSettingsDto,
  UpdatePublicSettingsDto
} from './settings.dto';

export const UPLOAD_LIMITS = { limits: { fileSize: 10 * 1024 * 1024 + 1, files: 1 } };

@ApiTags('Configurações')
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('public/team')
  @Public()
  getPublic(): Promise<PublicTeamSettings> {
    return this.settings.getPublic();
  }

  @Get('team-settings/payment-info')
  @ApiBearerAuth()
  paymentInfo(): Promise<{ pixKey: string | null; bankingDetails: string | null }> {
    return this.settings.getPaymentInfo();
  }

  @Get('team-settings')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.dashboardRead)
  getAdmin(@CurrentPrincipal() principal: Principal): Promise<AdminTeamSettings> {
    return this.settings.getAdmin(principal);
  }

  @Patch('team-settings')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.settingsPublicManage)
  update(
    @CurrentPrincipal() principal: Principal,
    @Body() body: UpdatePublicSettingsDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AdminTeamSettings> {
    const patch = Object.fromEntries(
      Object.entries(body)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [
          key,
          typeof value === 'string' && value.trim() === '' ? null : value
        ])
    ) as PublicSettingsPatch;

    return this.settings.updatePublic(principal, patch, meta);
  }

  @Put('team-settings/financial')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.settingsFinancialManage)
  updateFinancial(
    @CurrentPrincipal() principal: Principal,
    @Body() body: UpdateFinancialSettingsDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AdminTeamSettings> {
    return this.settings.updateFinancial(
      principal,
      {
        ...(body.pixKey === undefined ? {} : { pixKey: body.pixKey }),
        ...(body.bankingDetails === undefined ? {} : { bankingDetails: body.bankingDetails })
      },
      meta
    );
  }

  /** Fotos do clube na página Sobre (DT-081): mesmo padrão das fotos do produto. */
  @Post('team-settings/photos')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(PERMISSIONS.logosManage)
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  addPhoto(
    @CurrentPrincipal() principal: Principal,
    @UploadedFile() file: IncomingFile | undefined,
    @Body() body: BrandAssetBodyDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AdminTeamSettings> {
    return this.settings.addPhoto(principal, file, body.altText ?? null, meta);
  }

  @Put('team-settings/photos/order')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.logosManage)
  reorderPhotos(
    @CurrentPrincipal() principal: Principal,
    @Body() body: ClubPhotoOrderDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AdminTeamSettings> {
    return this.settings.reorderPhotos(principal, body.imageIds, meta);
  }

  @Patch('team-settings/photos/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.logosManage)
  describePhoto(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: BrandAssetBodyDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AdminTeamSettings> {
    return this.settings.describePhoto(principal, id, body.altText ?? null, meta);
  }

  @Delete('team-settings/photos/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.logosManage)
  removePhoto(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<AdminTeamSettings> {
    return this.settings.removePhoto(principal, id, meta);
  }

  @Put('team-settings/brand-assets/:context')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(PERMISSIONS.logosManage)
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  setBrandAsset(
    @CurrentPrincipal() principal: Principal,
    @Param('context', new ParseEnumPipe(TeamBrandContext)) context: TeamBrandContext,
    @UploadedFile() file: IncomingFile | undefined,
    @Body() body: BrandAssetBodyDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AdminTeamSettings> {
    return this.settings.setBrandAsset(
      principal,
      context,
      file,
      body.altText?.trim() || null,
      meta
    );
  }
}
