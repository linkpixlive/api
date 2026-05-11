import { Controller, Delete, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { SafeUser } from 'src/modules/auth/entities/safe-user.entity';
import { OverlayService } from './overlay.service';

@ApiTags('Overlay')
@ApiBearerAuth()
@Controller('overlay')
export class OverlayController {
  constructor(private readonly overlayService: OverlayService) {}

  @Post('test')
  @ApiOperation({ summary: 'Send a test notification to the overlay' })
  async test(@CurrentUser() user: SafeUser) {
    return this.overlayService.testOverlay(user.id);
  }

  @Post('toggle-pause')
  @ApiOperation({ summary: 'Toggle pause state of overlay alerts' })
  async togglePause(@CurrentUser() user: SafeUser) {
    return this.overlayService.togglePause(user.id);
  }

  @Post('skip')
  @ApiOperation({ summary: 'Skip the current alert and dispatch the next one' })
  async skip(@CurrentUser() user: SafeUser) {
    return this.overlayService.skipCurrent(user.id);
  }

  @Delete('queue')
  @ApiOperation({ summary: 'Clear all pending alerts from the queue' })
  async clearQueue(@CurrentUser() user: SafeUser) {
    return this.overlayService.clearQueue(user.id);
  }

  @Post('replay/:donationId')
  @ApiOperation({ summary: 'Re-add a donation to the alert queue for replay' })
  async replay(
    @CurrentUser() user: SafeUser,
    @Param('donationId') donationId: string,
  ) {
    return this.overlayService.replayDonation(user.id, donationId);
  }
}
