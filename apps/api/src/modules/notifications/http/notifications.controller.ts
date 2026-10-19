import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import { type Page, PageQueryDto } from '../../../common/http/pagination';
import { CurrentPrincipal, type Principal } from '../../../common/http/request-context';
import { NotificationsService, type NotificationView } from '../application/notifications.service';

export class NotificationQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unread?: boolean;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

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

  @Post('read-all')
  @HttpCode(200)
  async readAll(@CurrentPrincipal() principal: Principal): Promise<{ updated: number }> {
    return { updated: await this.notifications.markAllRead(principal.userId) };
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
