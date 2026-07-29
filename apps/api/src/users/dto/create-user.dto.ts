import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Pessoa de Teste' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  public readonly name!: string;

  @ApiProperty({ example: 'pessoa@example.test' })
  @IsEmail()
  @MaxLength(180)
  public readonly email!: string;

  @ApiProperty({ minLength: 8, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  public readonly password!: string;
}
