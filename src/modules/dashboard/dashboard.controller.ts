import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { DashboardService } from './dashboard.service';
import { GetHistoryQueryDto } from './dto/get-history-query.dto';
import { DashboardStatsEntity } from './entities/dashboard-stats.entity';
import { DonationHistoryEntity } from './entities/donation-history.entity';

@ApiBearerAuth()
@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Obter estatísticas de doações dos últimos 30 dias',
  })
  @ApiResponse({
    status: 200,
    type: DashboardStatsEntity,
    description: 'Estatísticas retornadas com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  getStats(@CurrentUser() user: SafeUser) {
    return this.dashboardService.getStats(user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Obter histórico de doações paginado' })
  @ApiResponse({
    status: 200,
    type: DonationHistoryEntity,
    description: 'Histórico retornado com sucesso.',
  })
  @ApiResponse({ status: 400, description: 'Parâmetros de query inválidos.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  getHistory(
    @CurrentUser() user: SafeUser,
    @Query() query: GetHistoryQueryDto,
  ) {
    return this.dashboardService.getHistory(user.id, query);
  }
}
