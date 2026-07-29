import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

const NONNEGATIVE_MONEY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/u;

export class OpenCashSessionDto {
  @ApiProperty()
  @IsUUID()
  public readonly accountId!: string;

  @ApiProperty({ example: '100.00', type: String })
  @IsString()
  @Matches(NONNEGATIVE_MONEY_PATTERN)
  public readonly openingBalance!: string;
}

export class CloseCashSessionDto {
  @ApiProperty({ example: '155.25', type: String })
  @IsString()
  @Matches(NONNEGATIVE_MONEY_PATTERN)
  public readonly countedFinalBalance!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  public readonly reason?: string;
}
