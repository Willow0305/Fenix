import { Module } from '@nestjs/common';

import { AnnouncementsService } from './application/announcements.service';
import { ContentAlertsService } from './application/content-alerts.service';
import { EventsService } from './application/events.service';
import { ForumService } from './application/forum.service';
import { NewsGalleryService } from './application/news-gallery.service';
import { NewsViewsService } from './application/news-views.service';
import { NewsTagsService } from './application/news-tags.service';
import { NewsService } from './application/news.service';
import { ContentController } from './http/content.controller';

@Module({
  controllers: [ContentController],
  providers: [
    NewsService,
    NewsTagsService,
    NewsGalleryService,
    NewsViewsService,
    EventsService,
    ForumService,
    AnnouncementsService,
    ContentAlertsService
  ]
})
export class ContentModule {}
