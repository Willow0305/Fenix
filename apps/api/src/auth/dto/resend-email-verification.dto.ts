import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class ResendEmailVerificationDto {
  @ApiProperty({ example: 'usuario@example.test' })
  @IsEmail()
  @MaxLength(180)
  public email!: string;
}
