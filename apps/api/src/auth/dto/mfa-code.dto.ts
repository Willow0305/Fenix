import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class MfaCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 24)
  @Matches(/^[A-Za-z0-9-]+$/u)
  public code!: string;
}
