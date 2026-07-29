import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches, MaxLength } from 'class-validator';

export class MfaChallengeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(300)
  public challengeToken!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 24)
  @Matches(/^[A-Za-z0-9-]+$/u)
  public code!: string;
}
