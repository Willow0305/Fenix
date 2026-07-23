import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { HealthResponseDto } from './health-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Verifica se o processo da API está disponível.'
  })
  @ApiOkResponse({
    type: HealthResponseDto
  })
  public getHealth(): HealthResponseDto {
    return new HealthResponseDto(new Date().toISOString());
  }
}
