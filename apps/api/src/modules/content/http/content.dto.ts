import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EventStatus,
  EventType,
  ForumReactionType,
  ForumReportStatus,
  ForumVisibility,
  NewsStatus
} from '../../../generated/prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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
  MinLength,
  ValidateNested
} from 'class-validator';

import { PageQueryDto } from '../../../common/http/pagination';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class NewsCategoryDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

export class UpdateNewsCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class NewsTagDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name!: string;
}

export class UpdateNewsTagDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class NewsDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(180) title!: string;
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiProperty({ description: 'Texto simples; marcação HTML é removida.' })
  @IsString()
  @MinLength(10)
  @MaxLength(50000)
  content!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(SLUG, { message: 'Endereço inválido: use letras minúsculas, números e hífens.' })
  @MaxLength(180)
  slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() eventId?: string;
  @ApiPropertyOptional({ type: [String], description: 'Até 5 assuntos da lista (D8).' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('4', { each: true })
  tagIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showOnHome?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showOnForum?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFeatured?: boolean;
}

export class UpdateNewsDto {
  @ApiPropertyOptional({ type: [String], description: 'Lista completa; vazia remove todos.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('4', { each: true })
  tagIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(180) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(50000)
  content?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(SLUG, { message: 'Endereço inválido: use letras minúsculas, números e hífens.' })
  @MaxLength(180)
  slug?: string;
  @ApiPropertyOptional({ description: 'String vazia remove o vínculo.' })
  @IsOptional()
  @Matches(/^([0-9a-f-]{36})?$/i, { message: 'Evento inválido.' })
  eventId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showOnHome?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showOnForum?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFeatured?: boolean;
}

export class PublishNewsDto {
  @ApiPropertyOptional({ description: 'Instante UTC futuro para agendar; vazio publica agora.' })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}

export class NewsStatusDto {
  @ApiProperty({ enum: ['HIDDEN', 'ARCHIVED', 'DRAFT'] })
  @IsIn(['HIDDEN', 'ARCHIVED', 'DRAFT'])
  status!: 'HIDDEN' | 'ARCHIVED' | 'DRAFT';
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(1000) reason?: string;
}

export class NewsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: NewsStatus }) @IsOptional() @IsEnum(NewsStatus) status?: NewsStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
}

export class PublicNewsQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @Matches(SLUG) category?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(SLUG) tag?: string;
  @ApiPropertyOptional({ enum: ['home', 'forum'] })
  @IsOptional()
  @IsIn(['home', 'forum'])
  channel?: 'home' | 'forum';
}

export class MatchDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) opponentName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) competitionName?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isHome?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID() teamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(99) teamScore?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(99) opponentScore?: number;
}

export class ExternalMatchDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) homeTeamName!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) awayTeamName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) competitionName?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(99) homeScore?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(99) awayScore?: number;
}

/** Dados de agenda e de evento externo (D3, DT-081); texto vazio apaga o valor. */
class EventDetailsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isExternal?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) organizerName?: string;
  @ApiPropertyOptional({ description: 'Endereço https da página oficial.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  officialUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) city?: string;
  @ApiPropertyOptional({ description: 'UF (ex.: AC); vazio fora do Brasil.' })
  @IsOptional()
  @Matches(/^([A-Za-z]{2})?$/, { message: 'Use a sigla da UF, como AC.' })
  state?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFree?: boolean;
  @ApiPropertyOptional({ example: '20.00', description: 'Vazio apaga o preço.' })
  @IsOptional()
  @Matches(/^(\d{1,8}(\.\d{1,2})?)?$/, { message: 'Informe o preço como 20.00.' })
  ticketPrice?: string;
  @ApiPropertyOptional({ type: ExternalMatchDto, nullable: true, description: 'null remove.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExternalMatchDto)
  externalMatch?: ExternalMatchDto | null;
}

export class EventDto extends EventDetailsDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(180) title!: string;
  @ApiProperty({ enum: EventType }) @IsEnum(EventType) type!: EventType;
  @ApiProperty() @IsISO8601() startsAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() endsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(180) locationName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublic?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID() tryoutId?: string;
  @ApiPropertyOptional({ type: MatchDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MatchDto)
  match?: MatchDto;
}

export class UpdateEventDto extends EventDetailsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(180) title?: string;
  @ApiPropertyOptional({ enum: EventType }) @IsOptional() @IsEnum(EventType) type?: EventType;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() startsAt?: string;
  @ApiPropertyOptional({ description: 'String vazia remove o término.' })
  @IsOptional()
  @IsString()
  endsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(180) locationName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublic?: boolean;
  @ApiPropertyOptional({ description: 'String vazia desfaz o vínculo.' })
  @IsOptional()
  @Matches(/^([0-9a-f-]{36})?$/i, { message: 'Seletiva inválida.' })
  tryoutId?: string;
  @ApiPropertyOptional({ type: MatchDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MatchDto)
  match?: MatchDto;
}

export class EventStatusDto {
  @ApiProperty({ enum: EventStatus }) @IsEnum(EventStatus) status!: EventStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(1000) reason?: string;
}

export class EventQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
  @ApiPropertyOptional({ enum: EventType }) @IsOptional() @IsEnum(EventType) type?: EventType;
}

export class PublicEventQueryDto {
  @ApiPropertyOptional({ enum: ['upcoming', 'past'] })
  @IsOptional()
  @IsIn(['upcoming', 'past'])
  scope?: 'upcoming' | 'past';
  @ApiPropertyOptional({ enum: EventType }) @IsOptional() @IsEnum(EventType) type?: EventType;
  @ApiPropertyOptional({ enum: ['fenix', 'external'] })
  @IsOptional()
  @IsIn(['fenix', 'external'])
  origin?: 'fenix' | 'external';
  @ApiPropertyOptional({ enum: ['acre', 'outros'] })
  @IsOptional()
  @IsIn(['acre', 'outros'])
  region?: 'acre' | 'outros';
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  limit?: number;
}

export class ForumCategoryDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiProperty({ enum: ForumVisibility }) @IsEnum(ForumVisibility) visibility!: ForumVisibility;
}

export class UpdateForumCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiPropertyOptional({ enum: ForumVisibility })
  @IsOptional()
  @IsEnum(ForumVisibility)
  visibility?: ForumVisibility;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class TopicDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(180) title!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(10000) content!: string;
  @ApiPropertyOptional({ description: 'Comunicado fixado (exige forum.publish).' })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export class PostDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(10000) content!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentPostId?: string;
}

export class EditPostDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(10000) content!: string;
}

export class ReactionDto {
  @ApiProperty({ enum: ForumReactionType })
  @IsEnum(ForumReactionType)
  type!: ForumReactionType;
}

export class ReportDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() postId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() topicId?: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(180) reason!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) details?: string;
}

export class TopicModerationDto {
  @ApiProperty({ enum: ['HIDE', 'RESTORE', 'CLOSE', 'REOPEN', 'PIN', 'UNPIN'] })
  @IsIn(['HIDE', 'RESTORE', 'CLOSE', 'REOPEN', 'PIN', 'UNPIN'])
  action!: 'HIDE' | 'RESTORE' | 'CLOSE' | 'REOPEN' | 'PIN' | 'UNPIN';
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) reason!: string;
}

export class PostModerationDto {
  @ApiProperty({ enum: ['HIDE', 'RESTORE', 'DELETE'] })
  @IsIn(['HIDE', 'RESTORE', 'DELETE'])
  action!: 'HIDE' | 'RESTORE' | 'DELETE';
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) reason!: string;
}

export class ReportQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ForumReportStatus })
  @IsOptional()
  @IsEnum(ForumReportStatus)
  status?: ForumReportStatus;
}

export class ReviewReportDto {
  @ApiProperty({ enum: ['UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] })
  @IsIn(['UNDER_REVIEW', 'RESOLVED', 'DISMISSED'])
  status!: 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  resolution?: string;
}

export class ModerationQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() topicId?: string;
}

export class BroadcastDto {
  @ApiProperty({ enum: ['ACTIVE_ATHLETES', 'TEAM', 'STAFF', 'ALL_USERS'] })
  @IsIn(['ACTIVE_ATHLETES', 'TEAM', 'STAFF', 'ALL_USERS'])
  audience!: 'ACTIVE_ATHLETES' | 'TEAM' | 'STAFF' | 'ALL_USERS';
  @ApiPropertyOptional() @IsOptional() @IsUUID() teamId?: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(180) title!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(2000) message!: string;
  @ApiPropertyOptional({ description: 'Link interno (ex.: /eventos).' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  link?: string;
}
