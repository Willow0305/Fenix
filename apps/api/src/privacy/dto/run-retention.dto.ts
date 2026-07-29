import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class RunRetentionDto {
  @ApiProperty({
    description: 'Quando true, apenas calcula candidatos sem alterar registros.',
    default: true
  })
  @IsBoolean()
  public dryRun!: boolean;
}
