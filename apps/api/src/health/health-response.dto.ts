import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    enum: ['ok'],
    example: 'ok'
  })
  public readonly status = 'ok' as const;

  @ApiProperty({
    example: 'fenix-api',
    type: String
  })
  public readonly service: string = 'fenix-api';

  @ApiProperty({
    example: '2026-07-23T18:00:00.000Z',
    format: 'date-time',
    type: String
  })
  public readonly timestamp: string;

  public constructor(timestamp: string) {
    this.timestamp = timestamp;
  }
}
