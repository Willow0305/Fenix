import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class RequestPasswordRecoveryDto {
  @ApiProperty({ example: 'usuario@example.test' })
  @IsEmail()
  @MaxLength(180)
  public readonly email!: string;
}
