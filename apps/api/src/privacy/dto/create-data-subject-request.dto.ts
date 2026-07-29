import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataSubjectRequestType } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

export class CreateDataSubjectRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  public subjectUserId?: string;

  @ApiProperty({ example: 'titular@example.test' })
  @IsEmail()
  @MaxLength(180)
  public requesterEmail!: string;

  @ApiProperty({ enum: DataSubjectRequestType })
  @IsEnum(DataSubjectRequestType)
  public type!: DataSubjectRequestType;

  @ApiProperty({ example: 'canal interno' })
  @IsString()
  @Length(2, 80)
  public channel!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  public description?: string;
}
