import { ApiProperty } from '@nestjs/swagger';

export class DashboardStatsEntity {
  @ApiProperty({
    example: 1500.5,
    description: 'Valor total de doações nos últimos 30 dias',
  })
  totalAmount: number;

  @ApiProperty({
    example: 42,
    description: 'Número total de doações nos últimos 30 dias',
  })
  totalCount: number;

  @ApiProperty({
    example: 4,
    description: 'Dia da semana com mais doações (0-6, onde 0 é domingo)',
    nullable: true,
  })
  peakDay: number | null;

  @ApiProperty({
    example: 20,
    description: 'Hora do dia com mais doações (0-23)',
    nullable: true,
  })
  peakHour: number | null;

  @ApiProperty({
    example: 10,
    description: 'Valor de doação mais frequente',
    nullable: true,
  })
  modeAmount: number | null;

  constructor(partial: Partial<DashboardStatsEntity>) {
    Object.assign(this, partial);
  }
}
