import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { DashboardService } from './dashboard.service';
import { GetHistoryQueryDto } from './dto/get-history-query.dto';
import { GetStatsQueryDto } from './dto/get-stats-query.dto';
import { DashboardStatsEntity } from './entities/dashboard-stats.entity';
import { DonationHistoryEntity } from './entities/donation-history.entity';

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

  @Get('history/:id/audio')
  @ApiOperation({ summary: 'Baixar áudio da doação como anexo' })
  @ApiResponse({ status: 200, description: 'Arquivo de áudio.' })
  @ApiResponse({ status: 404, description: 'Áudio não disponível.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  async downloadAudio(
    @CurrentUser() user: SafeUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const audio = await this.dashboardService.getDonationAudio(user.id, id);
    res.set({
      'Content-Type': audio.contentType,
      'Content-Disposition': `attachment; filename="${audio.filename}"`,
      ...(audio.contentLength !== undefined
        ? { 'Content-Length': String(audio.contentLength) }
        : {}),
    });
    return new StreamableFile(audio.stream);
  }
}
