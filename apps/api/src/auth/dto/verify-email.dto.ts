import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'usuario@example.test' })
  @IsEmail()
  @MaxLength(180)
  public email!: string;

  @ApiProperty({ example: '12345678' })
  @IsString()
  @Length(8, 8)
  public code!: string;
}
