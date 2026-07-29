import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataSubjectRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDataSubjectRequestDto {
  @ApiProperty({ enum: DataSubjectRequestStatus })
  @IsEnum(DataSubjectRequestStatus)
  public status!: DataSubjectRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  public decisionReason?: string;
}
