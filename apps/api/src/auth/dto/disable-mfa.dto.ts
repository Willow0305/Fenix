import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches, MaxLength } from 'class-validator';

export class DisableMfaDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @Length(8, 128)
  public password!: string;

  @ApiProperty({ example: '123456', writeOnly: true })
  @IsString()
  @Length(6, 24)
  @Matches(/^[A-Za-z0-9-]+$/u)
  @MaxLength(24)
  public code!: string;
}
