import {
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength
} from 'class-validator';

import { IdempotencyKey } from '../../../common/http/idempotency';
import { type Page, PageQueryDto } from '../../../common/http/pagination';
import {
  CurrentPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { RequirePermissions } from '../../auth/http/auth.decorators';
import {
  type AccountabilityDetail,
  type AccountabilityPreview,
  type AccountabilityRow,
  AccountabilityService
} from '../application/accountability.service';

const IDEMPOTENCY_HEADER = { name: 'Idempotency-Key', required: true };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MSG = { message: 'Data inválida (AAAA-MM-DD).' };

class PeriodDto {
  @ApiProperty({ example: '2026-10-01' }) @Matches(DATE, DATE_MSG) from!: string;
  @ApiProperty({ example: '2026-10-31' }) @Matches(DATE, DATE_MSG) to!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Saídas que mostram a descrição do Caixa (com quem recebeu).'
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @IsUUID('4', { each: true })
  showDetailFor?: string[];
}

class IssueDto extends PeriodDto {
  @ApiPropertyOptional({ type: [String], description: 'Quem assina; padrão: toda a diretoria.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  signatoryUserIds?: string[];

  @ApiPropertyOptional({ description: 'Observações da diretoria no documento.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Versão emitida que esta corrige.' })
  @IsOptional()
  @IsUUID()
  replacesId?: string;

  @ApiPropertyOptional({ description: 'O que foi corrigido (obrigatório ao corrigir).' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  replacementReason?: string;
}

/** Prestação de contas (DT-103): documento interno, fora do site. */
@ApiTags('Prestação de contas')
@ApiBearerAuth()
@Controller('accountability-reports')
export class AccountabilityController {
  constructor(private readonly accountability: AccountabilityService) {}

  @Post('preview')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.accountabilityIssue)
  preview(@Body() body: PeriodDto): Promise<AccountabilityPreview> {
    return this.accountability.preview(body.from, body.to, body.showDetailFor ?? []);
  }

  @Post()
  @ApiHeader(IDEMPOTENCY_HEADER)
  @RequirePermissions(PERMISSIONS.accountabilityIssue)
  issue(
    @CurrentPrincipal() actor: Principal,
    @Body() body: IssueDto,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<AccountabilityDetail> {
    return this.accountability.issue(
      actor,
      {
        from: body.from,
        to: body.to,
        showDetailFor: body.showDetailFor ?? [],
        signatoryUserIds: body.signatoryUserIds,
        notes: body.notes,
        replacesId: body.replacesId,
        replacementReason: body.replacementReason
      },
      key,
      meta
    );
  }

  @Get()
  @RequirePermissions(PERMISSIONS.accountabilityRead)
  list(@Query() query: PageQueryDto): Promise<Page<AccountabilityRow>> {
    return this.accountability.list(query);
  }

  @Get('verify/:code')
  @RequirePermissions(PERMISSIONS.accountabilityRead)
  async verify(@Param('code') code: string): Promise<{ found: AccountabilityRow | null }> {
    return { found: await this.accountability.verify(code.slice(0, 40)) };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.accountabilityRead)
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<AccountabilityDetail> {
    return this.accountability.get(id);
  }

  @Get(':id/pdf')
  @RequirePermissions(PERMISSIONS.accountabilityRead)
  async pdf(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @ReqMeta() meta: RequestMeta,
    @Res() res: Response
  ): Promise<void> {
    const file = await this.accountability.pdf(actor, id, meta);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(file.content);
  }
}

@Module({
  controllers: [AccountabilityController],
  providers: [AccountabilityService]
})
export class AccountabilityModule {}
