import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
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

  @Post('alerts/skip')
  @ApiOperation({
    summary: 'Skip the currently displayed alert on the overlay',
  })
  @ApiResponse({ status: 200, description: 'Skip command sent.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  skip(@CurrentUser() user: SafeUser) {
    return this.dashboardService.skip(user.id);
  }

  @Post('alerts/pause')
  @ApiOperation({ summary: 'Pause the overlay alert queue' })
  @ApiResponse({ status: 200, description: 'Pause command sent.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  pause(@CurrentUser() user: SafeUser) {
    return this.dashboardService.pause(user.id);
  }

  @Post('alerts/resume')
  @ApiOperation({ summary: 'Resume the overlay alert queue' })
  @ApiResponse({ status: 200, description: 'Resume command sent.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  resume(@CurrentUser() user: SafeUser) {
    return this.dashboardService.resume(user.id);
  }

  @Post('alerts/clear')
  @ApiOperation({ summary: 'Clear all pending alerts from the overlay queue' })
  @ApiResponse({ status: 200, description: 'Clear command sent.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  clear(@CurrentUser() user: SafeUser) {
    return this.dashboardService.clear(user.id);
  }

  @Post('alerts/replay/:id')
  @ApiOperation({ summary: 'Replay a past donation on the overlay' })
  @ApiResponse({ status: 200, description: 'Replay command sent.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Donation or user not found.' })
  replay(@CurrentUser() user: SafeUser, @Param('id') donationId: string) {
    return this.dashboardService.replay(user.id, donationId);
  }
}
