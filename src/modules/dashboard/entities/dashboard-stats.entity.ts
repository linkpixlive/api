import { ApiProperty } from '@nestjs/swagger';

export class DashboardStatsEntity {
  @ApiProperty({
    example: 1500.5,
    description: 'Total donation amount in the last 30 days',
  })
  totalAmount: number;

  @ApiProperty({
    example: 42,
    description: 'Total number of donations in the last 30 days',
  })
  totalCount: number;

  @ApiProperty({
    example: 4,
    description: 'Day of week with most donations (0-6, where 0 is Sunday)',
    nullable: true,
  })
  peakDay: number | null;

  @ApiProperty({
    example: 20,
    description: 'Hour of day with most donations (0-23)',
    nullable: true,
  })
  peakHour: number | null;

  @ApiProperty({
    example: 10,
    description: 'Most frequent donation amount',
    nullable: true,
  })
  modeAmount: number | null;

  constructor(partial: Partial<DashboardStatsEntity>) {
    Object.assign(this, partial);
  }
}
