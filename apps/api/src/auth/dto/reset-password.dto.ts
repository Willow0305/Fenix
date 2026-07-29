import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'usuario@example.test' })
  @IsEmail()
  @MaxLength(180)
  public readonly email!: string;

  @ApiProperty({ example: '123456', writeOnly: true })
  @IsString()
  @Matches(/^\d{6,8}$/u)
  public readonly code!: string;

  @ApiProperty({ minLength: 8, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  public readonly newPassword!: string;
}
