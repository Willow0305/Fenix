import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength
} from 'class-validator';

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export class CreateGuardianDto {
  @ApiProperty({ example: 'Responsável Fictício' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  public readonly fullName!: string;

  @ApiPropertyOptional({ example: 'responsavel@example.test' })
  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  public readonly email?: string;

  @ApiPropertyOptional({ example: '+5500000000000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  public readonly phone?: string;

  @ApiProperty({
    description: 'A primeira entrega aceita somente registros explicitamente fictícios.',
    example: true
  })
  @Equals(true)
  public readonly isFictitious!: true;
}

export class GuardianAuthorizationMetadataDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  public readonly guardianId!: string;

  @ApiProperty({ example: 'RESPONSÁVEL LEGAL' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  public readonly relationship!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  public readonly privateAttachmentId!: string;

  @ApiProperty({ example: 'dev-test-v1' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  public readonly version!: string;

  @ApiProperty({ example: '2026-07-27' })
  @Matches(CIVIL_DATE_PATTERN)
  public readonly validFrom!: string;

  @ApiProperty({ example: '2027-07-27' })
  @Matches(CIVIL_DATE_PATTERN)
  public readonly validUntil!: string;
}

export class LinkGuardianDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  public readonly guardianId!: string;

  @ApiProperty({ example: 'RESPONSÁVEL LEGAL' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  public readonly relationship!: string;

  @ApiProperty({ example: '2026-07-27' })
  @Matches(CIVIL_DATE_PATTERN)
  public readonly startsOn!: string;
}
