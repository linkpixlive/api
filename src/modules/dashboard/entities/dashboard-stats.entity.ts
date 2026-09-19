import { ApiProperty } from '@nestjs/swagger';

export class DashboardSeriesPoint {
  @ApiProperty({ example: '2026-09-10', description: 'Dia (YYYY-MM-DD)' })
  date: string;

  @ApiProperty({ example: 120.5, description: 'Valor somado no dia' })
  amount: number;

  @ApiProperty({ example: 3, description: 'Quantidade de doações no dia' })
  count: number;

  constructor(partial: Partial<DashboardSeriesPoint>) {
    Object.assign(this, partial);
  }
}

export class DashboardLargestDonation {
  @ApiProperty({ example: 50, description: 'Valor da maior doação do período' })
  amount: number;

  @ApiProperty({ example: 'Maria', description: 'Nome do doador' })
  donorName: string;

  @ApiProperty({
    example: '2026-09-15T20:00:00.000Z',
    description: 'Data de aprovação da doação',
  })
  date: string;

  constructor(partial: Partial<DashboardLargestDonation>) {
    Object.assign(this, partial);
  }
}

export class DashboardPreviousPeriod {
  @ApiProperty({ example: 380, description: 'Valor total do período anterior' })
  amount: number;

  @ApiProperty({ example: 18, description: 'Quantidade do período anterior' })
  count: number;

  constructor(partial: Partial<DashboardPreviousPeriod>) {
    Object.assign(this, partial);
  }
}

export class DashboardStatsEntity {
  @ApiProperty({ example: '7', enum: ['7', '15', '30'] })
  range: '7' | '15' | '30';

  @ApiProperty({ example: '2026-09-10T00:00:00.000Z' })
  start: string;

  @ApiProperty({ example: '2026-09-17T23:59:59.999Z' })
  end: string;

  @ApiProperty({
    example: 1500.5,
    description: 'Valor total de doações pagas/exibidas no período',
  })
  totalAmount: number;

  @ApiProperty({
    example: 42,
    description: 'Número total de doações pagas/exibidas no período',
  })
  totalCount: number;

  @ApiProperty({
    example: 35.73,
    description: 'Ticket médio do período (0 quando sem doações)',
  })
  average: number;

  @ApiProperty({
    type: DashboardLargestDonation,
    nullable: true,
    description: 'Maior doação do período',
  })
  largest: DashboardLargestDonation | null;

  @ApiProperty({ type: DashboardPreviousPeriod })
  previous: DashboardPreviousPeriod;

  @ApiProperty({
    example: 13.7,
    nullable: true,
    description:
      'Delta percentual do valor vs período anterior. Null quando o período anterior é zero.',
  })
  deltaAmountPct: number | null;

  @ApiProperty({
    example: 16.7,
    nullable: true,
    description:
      'Delta percentual da quantidade vs período anterior. Null quando o período anterior é zero.',
  })
  deltaCountPct: number | null;

  @ApiProperty({
    type: [DashboardSeriesPoint],
    description:
      'Série diária do período (dias sem doação vêm zerados), ordenada por data.',
  })
  series: DashboardSeriesPoint[];

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
