import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { DashboardService } from './dashboard.service';
import { DashboardStatsEntity } from './entities/dashboard-stats.entity';
import { DonationHistoryEntity } from './entities/donation-history.entity';

@ApiBearerAuth()
@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get 30-day donation statistics' })
  @ApiResponse({
    status: 200,
    type: DashboardStatsEntity,
    description: 'Stats returned successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getStats(@CurrentUser() user: SafeUser) {
    return this.dashboardService.getStats(user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get paginated donation history' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    type: DonationHistoryEntity,
    description: 'History returned successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getHistory(
    @CurrentUser() user: SafeUser,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    return this.dashboardService.getHistory(user.id, page, limit);
  }
}
