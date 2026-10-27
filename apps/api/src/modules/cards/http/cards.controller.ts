import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BenefitAudience, CardTemplate } from '../../../generated/prisma/client';
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
import { type Page, PageQueryDto } from '../../../common/http/pagination';
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
  type BenefitAdminView,
  BenefitsService,
  type BenefitView
} from '../application/benefits.service';
import {
  type CardAdminDetail,
  type CardAdminRow,
  type CardsOverview,
  type CardDesign,
  type CardQr,
  CardsService,
  type CardView,
  type MyCardsView,
  type PublicValidation,
  type StaffValidation
} from '../application/cards.service';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MSG = { message: 'Data inválida (AAAA-MM-DD).' };
const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;
/** Ações simples, só com motivo. */
const CARD_ACTIONS = {
  suspend: 'suspend',
  reactivate: 'reactivate',
  cancel: 'cancel',
  reissue: 'reissue'
} as const;

class CardListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ['ATHLETE', 'AFFILIATE'] })
  @IsOptional()
  @IsIn(['ATHLETE', 'AFFILIATE'])
  type?: 'ATHLETE' | 'AFFILIATE';

  @ApiPropertyOptional({ enum: ['valid', 'suspended', 'expired', 'cancelled'] })
  @IsOptional()
  @IsIn(['valid', 'suspended', 'expired', 'cancelled'])
  situation?: 'valid' | 'suspended' | 'expired' | 'cancelled';

  @ApiPropertyOptional({ description: 'Só as carteirinhas vendidas por este plano.' })
  @IsOptional()
  @IsUUID()
  planId?: string;
}

class CardExtendDto extends DeleteReasonDto {
  @ApiProperty() @Matches(DATE, DATE_MSG) endsOn!: string;
}

class CardRenameDto extends DeleteReasonDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(160) holderName!: string;
}

class CardDesignDto {
  @ApiProperty({ enum: CardTemplate }) @IsEnum(CardTemplate) template!: CardTemplate;
  @ApiProperty() @IsBoolean() useTeamLogo!: boolean;
}

class BenefitDto {
  @ApiProperty() @IsUUID() partnerId!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(120) title!: string;
  @ApiProperty({ example: '10' })
  @Matches(PERCENT, { message: 'Percentual inválido.' })
  discountPercent!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) conditions?: string;
  @ApiProperty({ enum: BenefitAudience }) @IsEnum(BenefitAudience) audience!: BenefitAudience;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) startsOn?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) endsOn?: string;
}

class UpdateBenefitDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(120) title?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(PERCENT, { message: 'Percentual inválido.' })
  discountPercent?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) conditions?: string;
  @ApiPropertyOptional({ enum: BenefitAudience })
  @IsOptional()
  @IsEnum(BenefitAudience)
  audience?: BenefitAudience;
  @ApiPropertyOptional({ description: 'Vazio remove o início.' })
  @IsOptional()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/, DATE_MSG)
  startsOn?: string;
  @ApiPropertyOptional({ description: 'Vazio remove o fim.' })
  @IsOptional()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/, DATE_MSG)
  endsOn?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

class BenefitQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() partnerId?: string;
}

/** Conferência pública (parceiros, sem login) e benefícios do site (DT-068). */
@ApiTags('Carteirinha')
@Public()
@Controller('public')
export class PublicCardsController {
  constructor(
    private readonly cards: CardsService,
    private readonly benefits: BenefitsService
  ) {}

  @Get('cards/validate/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  validate(@Param('token') token: string): Promise<PublicValidation> {
    return this.cards.validatePublic(token);
  }

  @Get('benefits')
  publicBenefits(@Query() query: BenefitQueryDto): Promise<BenefitView[]> {
    return this.benefits.publicList(query.partnerId);
  }
}

/** Carteirinhas da própria conta. */
@ApiTags('Minha conta')
@ApiBearerAuth()
@Controller('me/cards')
export class MyCardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal): Promise<MyCardsView> {
    return this.cards.myCards(principal.userId);
  }

  @Get(':id/qr')
  qr(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<CardQr> {
    return this.cards.liveQr(principal.userId, id);
  }

  @Get(':id/print')
  print(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<CardView & CardQr & { design: CardDesign }> {
    return this.cards.printed(principal.userId, id);
  }
}

/** Administração das carteirinhas e conferência pela diretoria. */
@ApiTags('Carteirinha')
@ApiBearerAuth()
@Controller('cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get('validate/:token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @RequirePermissions(PERMISSIONS.cardsRead)
  validate(
    @CurrentPrincipal() principal: Principal,
    @Param('token') token: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<StaffValidation> {
    return this.cards.validateStaff(principal, token, meta);
  }

  @Get('design')
  @RequirePermissions(PERMISSIONS.cardsRead)
  design(): Promise<CardDesign> {
    return this.cards.design();
  }

  @Put('design')
  @RequirePermissions(PERMISSIONS.cardsManage)
  setDesign(
    @CurrentPrincipal() actor: Principal,
    @Body() body: CardDesignDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CardDesign> {
    return this.cards.setDesign(actor, body, meta);
  }

  @Get('overview')
  @RequirePermissions(PERMISSIONS.cardsRead)
  overview(): Promise<CardsOverview> {
    return this.cards.overview();
  }

  @Get()
  @RequirePermissions(PERMISSIONS.cardsRead)
  list(@Query() query: CardListQueryDto): Promise<Page<CardAdminRow>> {
    return this.cards.list(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.cardsRead)
  detail(@Param('id', new ParseUUIDPipe()) id: string): Promise<CardAdminDetail> {
    return this.cards.detail(id);
  }

  @Post(':id/:action')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.cardsManage)
  change(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('action', new ParseEnumPipe(CARD_ACTIONS))
    action: (typeof CARD_ACTIONS)[keyof typeof CARD_ACTIONS],
    @Body() body: DeleteReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CardAdminDetail> {
    return this.cards.change(actor, id, action, { reason: body.reason }, meta);
  }

  @Put(':id/ends-on')
  @RequirePermissions(PERMISSIONS.cardsManage)
  extend(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CardExtendDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CardAdminDetail> {
    return this.cards.change(actor, id, 'extend', body, meta);
  }

  @Put(':id/holder-name')
  @RequirePermissions(PERMISSIONS.cardsManage)
  rename(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CardRenameDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CardAdminDetail> {
    return this.cards.change(actor, id, 'rename', body, meta);
  }
}

/** Benefícios de parceiros (DT-068 D). */
@ApiTags('Carteirinha')
@ApiBearerAuth()
@Controller('partner-benefits')
export class BenefitsController {
  constructor(private readonly benefits: BenefitsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.benefitsManage)
  list(@Query() query: BenefitQueryDto): Promise<BenefitAdminView[]> {
    return this.benefits.adminList(query.partnerId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.benefitsManage)
  create(
    @CurrentPrincipal() actor: Principal,
    @Body() body: BenefitDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<BenefitAdminView> {
    return this.benefits.create(actor, defined(body), meta);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.benefitsManage)
  update(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateBenefitDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<BenefitAdminView> {
    const { startsOn, endsOn, ...rest } = defined(body);

    return this.benefits.update(
      actor,
      id,
      {
        ...rest,
        ...(startsOn === undefined ? {} : { startsOn: startsOn || null }),
        ...(endsOn === undefined ? {} : { endsOn: endsOn || null })
      },
      meta
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.benefitsManage)
  async remove(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DeleteReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.benefits.remove(actor, id, body.reason, meta);
  }
}

@Module({
  controllers: [PublicCardsController, MyCardsController, CardsController, BenefitsController],
  providers: [CardsService, BenefitsService],
  exports: [CardsService]
})
export class CardsModule {}
