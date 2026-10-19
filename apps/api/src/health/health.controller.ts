import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../modules/auth/http/auth.decorators';
import { HealthResponseDto } from './health-response.dto';

@ApiTags('health')
@Public()
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
