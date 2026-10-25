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
  Put,
  Query,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { IdempotencyKey } from '../../../common/http/idempotency';
import { type Page, PageQueryDto } from '../../../common/http/pagination';
import {
  CurrentPrincipal,
  OptionalPrincipal,
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
  AnnouncementsService,
  type BroadcastHistoryItem,
  type BroadcastResult
} from '../application/announcements.service';
import { type EventView, EventsService } from '../application/events.service';
import {
  type ForumCategoryView,
  ForumService,
  type ModerationView,
  type PostView,
  type ReportView,
  type TopicDetail,
  type TopicSummary
} from '../application/forum.service';
import {
  type NewsCategoryView,
  type NewsDetail,
  NewsService,
  type NewsSummary
} from '../application/news.service';
import {
  BroadcastDto,
  EditPostDto,
  EventDto,
  EventQueryDto,
  EventStatusDto,
  ForumCategoryDto,
  ModerationQueryDto,
  NewsCategoryDto,
  NewsDto,
  NewsQueryDto,
  NewsStatusDto,
  PostDto,
  PostModerationDto,
  PublicEventQueryDto,
  PublicNewsQueryDto,
  PublishNewsDto,
  ReactionDto,
  ReportDto,
  ReportQueryDto,
  ReviewReportDto,
  TopicDto,
  TopicModerationDto,
  UpdateEventDto,
  UpdateForumCategoryDto,
  UpdateNewsCategoryDto,
  UpdateNewsDto
} from './content.dto';
import { DeleteReasonDto } from '../../../common/http/delete-reason.dto';

const IDEMPOTENCY_HEADER = { name: 'Idempotency-Key', required: true };

@ApiTags('content')
@Controller()
export class ContentController {
  constructor(
    private readonly news: NewsService,
    private readonly events: EventsService,
    private readonly forum: ForumService,
    private readonly announcements: AnnouncementsService
  ) {}

  // ---------- Notícias (público) ----------

  @Get('public/news')
  @Public()
  publicNews(@Query() query: PublicNewsQueryDto): Promise<Page<NewsSummary>> {
    return this.news.publicList(defined(query));
  }

  @Get('public/news/:slug')
  @Public()
  publicNewsItem(@Param('slug') slug: string): Promise<NewsDetail> {
    return this.news.publicGet(slug);
  }

  @Get('public/news-categories')
  @Public()
  publicNewsCategories(): Promise<NewsCategoryView[]> {
    return this.news.categories(true);
  }

  // ---------- Notícias (diretoria) ----------

  @Get('news-categories')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.newsManage)
  newsCategories(): Promise<NewsCategoryView[]> {
    return this.news.categories(false);
  }

  @Post('news-categories')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.newsManage)
  createNewsCategory(
    @CurrentPrincipal() actor: Principal,
    @Body() body: NewsCategoryDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<NewsCategoryView> {
    return this.news.createCategory(actor, defined(body), meta);
  }

  @Patch('news-categories/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.newsManage)
  updateNewsCategory(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateNewsCategoryDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<NewsCategoryView> {
    return this.news.updateCategory(actor, id, defined(body), meta);
  }

  @Delete('news-categories/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.newsManage)
  async deleteNewsCategory(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DeleteReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.news.deleteCategory(actor, id, body.reason, meta);
  }

  @Get('news')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.newsManage)
  listNews(@Query() query: NewsQueryDto): Promise<Page<NewsDetail>> {
    return this.news.list(defined(query));
  }

  @Get('news/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.newsManage)
  getNews(@Param('id', new ParseUUIDPipe()) id: string): Promise<NewsDetail> {
    return this.news.get(id);
  }

  @Post('news')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.newsManage)
  createNews(
    @CurrentPrincipal() actor: Principal,
    @Body() body: NewsDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<NewsDetail> {
    return this.news.create(actor, defined(body), meta);
  }

  @Patch('news/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.newsManage)
  updateNews(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateNewsDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<NewsDetail> {
    const { eventId, ...rest } = body;

    return this.news.update(
      actor,
      id,
      { ...defined(rest), ...(eventId === undefined ? {} : { eventId: eventId || null }) },
      meta
    );
  }

  @Post('news/:id/publish')
  @HttpCode(200)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.newsManage)
  publishNews(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PublishNewsDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<NewsDetail> {
    return this.news.publish(actor, id, body.scheduledAt, meta);
  }

  @Put('news/:id/status')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.newsManage)
  newsStatus(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: NewsStatusDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<NewsDetail> {
    return this.news.changeStatus(actor, id, body.status, body.reason, meta);
  }

  @Post('news/:id/cover')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(PERMISSIONS.newsManage)
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  newsCover(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: IncomingFile | undefined,
    @ReqMeta() meta: RequestMeta
  ): Promise<NewsDetail> {
    return this.news.setCover(actor, id, file, meta);
  }

  // ---------- Eventos ----------

  @Get('public/events')
  @Public()
  publicEvents(@Query() query: PublicEventQueryDto): Promise<EventView[]> {
    return this.events.publicList(defined(query));
  }

  @Get('public/events/:slug')
  @Public()
  publicEvent(@Param('slug') slug: string): Promise<EventView> {
    return this.events.publicGet(slug);
  }

  @Get('events')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.eventsManage)
  listEvents(@Query() query: EventQueryDto): Promise<Page<EventView>> {
    return this.events.list(defined(query));
  }

  @Get('events/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.eventsManage)
  getEvent(@Param('id', new ParseUUIDPipe()) id: string): Promise<EventView> {
    return this.events.get(id);
  }

  @Post('events')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.eventsManage)
  createEvent(
    @CurrentPrincipal() actor: Principal,
    @Body() body: EventDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<EventView> {
    const { match, ...rest } = body;

    return this.events.create(
      actor,
      { ...defined(rest), ...(match ? { match: defined(match) } : {}) },
      meta
    );
  }

  @Post('events/:id/cover')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(PERMISSIONS.eventsManage)
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  eventCover(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: IncomingFile | undefined,
    @ReqMeta() meta: RequestMeta
  ): Promise<EventView> {
    return this.events.setCover(actor, id, file, meta);
  }

  @Patch('events/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.eventsManage)
  updateEvent(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateEventDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<EventView> {
    const { match, endsAt, tryoutId, ...rest } = body;

    return this.events.update(
      actor,
      id,
      {
        ...defined(rest),
        ...(endsAt === undefined ? {} : { endsAt: endsAt || null }),
        ...(tryoutId === undefined ? {} : { tryoutId: tryoutId || null }),
        ...(match ? { match: defined(match) } : {})
      },
      meta
    );
  }

  @Put('events/:id/status')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.eventsManage)
  eventStatus(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: EventStatusDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<EventView> {
    return this.events.changeStatus(actor, id, body.status, body.reason, meta);
  }

  // ---------- Fórum (leitura conforme visibilidade) ----------

  @Get('forum/categories')
  @Public()
  forumCategories(
    @OptionalPrincipal() principal: Principal | undefined
  ): Promise<ForumCategoryView[]> {
    return this.forum.categories(principal);
  }

  @Get('forum/categories/:slug/topics')
  @Public()
  forumTopics(
    @Param('slug') slug: string,
    @OptionalPrincipal() principal: Principal | undefined,
    @Query() query: PageQueryDto
  ): Promise<{ category: ForumCategoryView; topics: Page<TopicSummary> }> {
    return this.forum.topics(slug, principal, defined(query));
  }

  @Get('forum/topics/:id')
  @Public()
  forumTopic(
    @Param('id', new ParseUUIDPipe()) id: string,
    @OptionalPrincipal() principal: Principal | undefined,
    @Query() query: PageQueryDto
  ): Promise<TopicDetail> {
    return this.forum.topic(id, principal, defined(query));
  }

  // ---------- Fórum (participação) ----------

  @Post('forum/categories/:slug/topics')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createTopic(
    @CurrentPrincipal() principal: Principal,
    @Param('slug') slug: string,
    @Body() body: TopicDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<TopicDetail> {
    return this.forum.createTopic(principal, slug, defined(body), meta);
  }

  @Post('forum/topics/:id/posts')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  reply(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PostDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<PostView> {
    return this.forum.reply(principal, id, defined(body), meta);
  }

  @Patch('forum/posts/:id')
  @ApiBearerAuth()
  editPost(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: EditPostDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<PostView> {
    return this.forum.editOwn(principal, id, body.content, meta);
  }

  @Delete('forum/posts/:id')
  @HttpCode(204)
  @ApiBearerAuth()
  async deletePost(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.forum.deleteOwn(principal, id, meta);
  }

  @Put('forum/posts/:id/reaction')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  react(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReactionDto
  ): Promise<PostView> {
    return this.forum.react(principal, id, body.type);
  }

  @Delete('forum/posts/:id/reaction')
  @ApiBearerAuth()
  unreact(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<PostView> {
    return this.forum.react(principal, id, null);
  }

  @Post('forum/reports')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  report(
    @CurrentPrincipal() principal: Principal,
    @Body() body: ReportDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<{ id: string; status: string }> {
    return this.forum.report(principal, defined(body), meta);
  }

  // ---------- Fórum (moderação) ----------

  @Get('forum/admin/categories')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.forumModerate)
  adminForumCategories(@CurrentPrincipal() actor: Principal): Promise<ForumCategoryView[]> {
    return this.forum.categories(actor, true);
  }

  @Post('forum/admin/categories')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.forumModerate)
  createForumCategory(
    @CurrentPrincipal() actor: Principal,
    @Body() body: ForumCategoryDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ForumCategoryView> {
    return this.forum.createCategory(actor, defined(body), meta);
  }

  @Patch('forum/admin/categories/:id')
  @HttpCode(204)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.forumModerate)
  async updateForumCategory(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateForumCategoryDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.forum.updateCategory(actor, id, defined(body), meta);
  }

  @Delete('forum/admin/categories/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.forumModerate)
  async deleteForumCategory(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DeleteReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.forum.deleteCategory(actor, id, body.reason, meta);
  }

  @Post('forum/topics/:id/moderation')
  @HttpCode(204)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.forumModerate)
  async moderateTopic(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: TopicModerationDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.forum.moderateTopic(actor, id, body.action, body.reason, meta);
  }

  @Post('forum/posts/:id/moderation')
  @HttpCode(204)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.forumModerate)
  async moderatePost(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PostModerationDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.forum.moderatePost(actor, id, body.action, body.reason, meta);
  }

  @Get('forum/reports')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.forumModerate)
  reports(@Query() query: ReportQueryDto): Promise<Page<ReportView>> {
    return this.forum.reports(defined(query));
  }

  @Put('forum/reports/:id')
  @HttpCode(204)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.forumModerate)
  async reviewReport(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReviewReportDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.forum.reviewReport(actor, id, body.status, body.resolution, meta);
  }

  @Get('forum/moderation-actions')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.forumModerate)
  moderationHistory(@Query() query: ModerationQueryDto): Promise<Page<ModerationView>> {
    return this.forum.moderationHistory(defined(query));
  }

  // ---------- Avisos ----------

  @Post('notifications/broadcast')
  @ApiBearerAuth()
  @ApiHeader(IDEMPOTENCY_HEADER)
  @RequirePermissions(PERMISSIONS.notificationsSend)
  broadcast(
    @CurrentPrincipal() actor: Principal,
    @Body() body: BroadcastDto,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<BroadcastResult> {
    return this.announcements.broadcast(actor, defined(body), key, meta);
  }

  @Get('notifications/broadcasts')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.notificationsSend)
  broadcasts(): Promise<BroadcastHistoryItem[]> {
    return this.announcements.history();
  }
}
