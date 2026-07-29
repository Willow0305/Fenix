import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsString, MaxLength } from 'class-validator';

export class UpdateUserRolesDto {
  @ApiProperty({ type: [String], example: ['USER'] })
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  public readonly roleCodes!: readonly string[];
}
