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
  @ApiOperation({ summary: 'Enviar notificação de teste para o overlay' })
  async test(@CurrentUser() user: SafeUser) {
    return this.overlayService.testOverlay(user.id);
  }

  @Post('toggle-pause')
  @ApiOperation({ summary: 'Alternar pausa dos alertas do overlay' })
  async togglePause(@CurrentUser() user: SafeUser) {
    return this.overlayService.togglePause(user.id);
  }

  @Post('skip')
  @ApiOperation({ summary: 'Pular o alerta atual e exibir o próximo' })
  async skip(@CurrentUser() user: SafeUser) {
    return this.overlayService.skipCurrent(user.id);
  }

  @Delete('queue')
  @ApiOperation({ summary: 'Limpar todos os alertas pendentes da fila' })
  async clearQueue(@CurrentUser() user: SafeUser) {
    return this.overlayService.clearQueue(user.id);
  }

  @Post('replay/:donationId')
  @ApiOperation({ summary: 'Readicionar doação à fila de alertas para repetir' })
  async replay(
    @CurrentUser() user: SafeUser,
    @Param('donationId') donationId: string,
  ) {
    return this.overlayService.replayDonation(user.id, donationId);
  }
}
