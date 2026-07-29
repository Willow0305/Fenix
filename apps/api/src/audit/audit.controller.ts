import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PERMISSION_CODES } from '../access-control/access.constants';
import { RequirePermissions } from '../access-control/access.decorators';
import { AuditService } from './audit.service';
import { ListAuditDto } from './dto/list-audit.dto';

@ApiTags('auditoria')
@Controller('audit-logs')
export class AuditController {
  public constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.auditRead)
  @ApiOperation({ summary: 'Consulta a trilha imutável e minimizada da Fase 1.' })
  public list(@Query() query: ListAuditDto) {
    return this.auditService.list(query);
  }
}
