import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Motivo obrigatório de exclusão lógica (fica na auditoria). */
export class DeleteReasonDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) reason!: string;
}
