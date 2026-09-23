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
import { GetStatsQueryDto } from './dto/get-stats-query.dto';
import { DashboardStatsEntity } from './entities/dashboard-stats.entity';

@ApiBearerAuth()
@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Obter estatísticas de doações do período (padrão 7 dias)',
  })
  @ApiResponse({
    status: 200,
    type: DashboardStatsEntity,
    description: 'Estatísticas retornadas com sucesso.',
  })
  @ApiResponse({ status: 400, description: 'Parâmetros de query inválidos.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  getStats(@CurrentUser() user: SafeUser, @Query() query: GetStatsQueryDto) {
    return this.dashboardService.getStats(user.id, query.range ?? '7');
  }
}
