import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { NotificationCategory } from '../../../generated/prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  ValidateNested
} from 'class-validator';

import { type Page, PageQueryDto } from '../../../common/http/pagination';
import {
  CurrentPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { RequirePermissions } from '../../auth/http/auth.decorators';
import { DeliveryService, type DeliverySummary } from '../application/delivery.service';
import { NotificationsService, type NotificationView } from '../application/notifications.service';
import { PreferencesService, type PreferencesView } from '../application/preferences.service';
import { CATEGORIES, EXTERNAL_CHANNELS, type ExternalChannel } from '../domain/channel-rules';

export class NotificationQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unread?: boolean;
}

export class PreferenceItemDto {
  @ApiProperty({ enum: NotificationCategory })
  @IsEnum(NotificationCategory, { message: 'Finalidade inválida.' })
  category!: NotificationCategory;

  @ApiProperty({ enum: EXTERNAL_CHANNELS })
  @IsIn(EXTERNAL_CHANNELS, { message: 'Canal inválido.' })
  channel!: ExternalChannel;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class UpdatePreferencesDto {
  @ApiProperty({ type: [PreferenceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CATEGORIES.length * EXTERNAL_CHANNELS.length)
  @ValidateNested({ each: true })
  @Type(() => PreferenceItemDto)
  items!: PreferenceItemDto[];
}

export class WhatsAppConsentDto {
  @ApiProperty({ description: 'true aceita receber avisos por WhatsApp; false retira.' })
  @IsBoolean()
  accept!: boolean;
}

@ApiTags('Notificações')
@ApiBearerAuth()
@Controller('me/notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly preferences: PreferencesService
  ) {}

  @Get()
  list(
    @CurrentPrincipal() principal: Principal,
    @Query() query: NotificationQueryDto
  ): Promise<Page<NotificationView>> {
    return this.notifications.list(principal.userId, query);
  }

  @Get('unread-count')
  async unread(@CurrentPrincipal() principal: Principal): Promise<{ count: number }> {
    return { count: await this.notifications.unreadCount(principal.userId) };
  }

  @Get('preferences')
  getPreferences(@CurrentPrincipal() principal: Principal): Promise<PreferencesView> {
    return this.preferences.get(principal.userId);
  }

  @Put('preferences')
  updatePreferences(
    @CurrentPrincipal() principal: Principal,
    @Body() body: UpdatePreferencesDto
  ): Promise<PreferencesView> {
    return this.preferences.update(principal.userId, body.items);
  }

  @Put('whatsapp-consent')
  whatsappConsent(
    @CurrentPrincipal() principal: Principal,
    @Body() body: WhatsAppConsentDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<PreferencesView> {
    return this.preferences.setWhatsAppConsent(principal.userId, body.accept, meta);
  }

  @Post('read-all')
  @HttpCode(200)
  async readAll(@CurrentPrincipal() principal: Principal): Promise<{ updated: number }> {
    return { updated: await this.notifications.markAllRead(principal.userId) };
  }

  @Delete('read')
  @HttpCode(200)
  async removeRead(@CurrentPrincipal() principal: Principal): Promise<{ removed: number }> {
    return { removed: await this.notifications.removeRead(principal.userId) };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<void> {
    await this.notifications.remove(principal.userId, id);
  }

  @Post(':id/read')
  @HttpCode(204)
  async read(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<void> {
    await this.notifications.markRead(principal.userId, id);
  }
}

@ApiTags('Notificações')
@ApiBearerAuth()
@Controller('notifications/deliveries')
export class DeliveriesController {
  constructor(private readonly delivery: DeliveryService) {}

  /** Situação dos canais e dos envios, sem destinatários nem conteúdo. */
  @Get('summary')
  @RequirePermissions(PERMISSIONS.notificationsSend)
  summary(): Promise<DeliverySummary> {
    return this.delivery.summary();
  }
}
