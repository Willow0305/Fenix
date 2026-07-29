import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ example: 'Nome atualizado' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  public readonly name!: string;
}
