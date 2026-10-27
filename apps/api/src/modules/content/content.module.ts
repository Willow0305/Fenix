import { Module } from '@nestjs/common';

import { AnnouncementsService } from './application/announcements.service';
import { ContentAlertsService } from './application/content-alerts.service';
import { EventsService } from './application/events.service';
import { ForumService } from './application/forum.service';
import { NewsService } from './application/news.service';
import { ContentController } from './http/content.controller';

@Module({
  controllers: [ContentController],
  providers: [NewsService, EventsService, ForumService, AnnouncementsService, ContentAlertsService]
})
export class ContentModule {}
