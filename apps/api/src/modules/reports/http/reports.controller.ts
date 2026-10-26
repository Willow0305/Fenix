import { Controller, Get, Module, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import type { Response } from 'express';

import {
  CurrentPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import { defined } from '../../../common/util/defined';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { RequirePermissions } from '../../auth/http/auth.decorators';
import { PartnersModule } from '../../partners/partners.module';
import { ReportsService } from '../application/reports.service';
import {
  type CashGrouping,
  type ReportDefinition,
  REPORTS,
  type ReportTable
} from '../domain/report-catalog';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ReportQueryDto {
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, { message: 'Data inválida.' }) from?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, { message: 'Data inválida.' }) to?: string;
  @ApiPropertyOptional({ enum: ['category', 'account', 'costCenter', 'origin'] })
  @IsOptional()
  @IsIn(['category', 'account', 'costCenter', 'origin'])
  groupBy?: CashGrouping;
}

/** Leitura (`reports.read`) e exportação (`reports.export`) são permissões distintas. */
@ApiTags('Relatórios')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.reportsRead)
  catalog(): readonly ReportDefinition[] {
    return REPORTS;
  }

  @Get(':key/csv')
  @RequirePermissions(PERMISSIONS.reportsRead, PERMISSIONS.reportsExport)
  async csv(
    @CurrentPrincipal() actor: Principal,
    @Param('key') key: string,
    @Query() query: ReportQueryDto,
    @ReqMeta() meta: RequestMeta,
    @Res() res: Response
  ): Promise<void> {
    const file = await this.reports.exportCsv(actor, key, defined(query), meta);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(file.content);
  }

  @Get(':key')
  @RequirePermissions(PERMISSIONS.reportsRead)
  run(@Param('key') key: string, @Query() query: ReportQueryDto): Promise<ReportTable> {
    return this.reports.run(key, defined(query));
  }
}

@Module({
  imports: [PartnersModule],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
