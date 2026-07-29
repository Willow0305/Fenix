import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ListAuditDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public readonly action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  public readonly actorUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  public readonly cursor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public readonly entityType?: string;

  @ApiPropertyOptional({
    default: 30,
    maximum: 100,
    minimum: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public readonly limit = 30;
}
