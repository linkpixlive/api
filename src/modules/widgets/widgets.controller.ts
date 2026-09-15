import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/isPublic';
import { WidgetSettingsPipe } from 'src/common/pipes/widget-settings.pipe';
import { SafeUser } from 'src/modules/auth/entities/safe-user.entity';
import { PublicWidgetParams, WidgetTypeParams } from './dto/widget-params.dto';
import type { AnyWidgetSettings } from './dto/widget-settings.map';
import { WidgetEntity } from './entities/widget.entity';
import { WidgetsService } from './widgets.service';

@ApiTags('Widgets')
@ApiBearerAuth()
@Controller('widgets')
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Public()
  @Get('public/:token')
  @ApiOperation({
    summary: 'Obter configurações públicas do widget para OBS/Uso externo',
  })
  @ApiResponse({ status: 200 })
  async getPublicSettings(@Param() { token }: PublicWidgetParams) {
    return this.widgetsService.getPublicWidgetSettings(token);
  }

  @Get(':type')
  @ApiOperation({ summary: 'Obter configurações de um tipo de widget' })
  @ApiResponse({ status: 200, type: WidgetEntity })
  async getSettings(
    @CurrentUser() user: SafeUser,
    @Param() { type }: WidgetTypeParams,
  ) {
    return this.widgetsService.getWidgetSettings(user.id, type);
  }

  @Put(':type')
  @ApiOperation({
    summary: 'Criar ou atualizar configurações de um tipo de widget',
  })
  @ApiResponse({ status: 200, type: WidgetEntity })
  async upsertSettings(
    @CurrentUser() user: SafeUser,
    @Param() { type }: WidgetTypeParams,
    @Body(WidgetSettingsPipe) settings?: AnyWidgetSettings,
  ) {
    return this.widgetsService.upsertWidgetSettings(user.id, type, settings);
  }

  @Post(':type/reset-token')
  @ApiOperation({ summary: 'Resetar o token de um tipo de widget' })
  @ApiResponse({ status: 200, type: WidgetEntity })
  async resetToken(
    @CurrentUser() user: SafeUser,
    @Param() { type }: WidgetTypeParams,
  ) {
    return this.widgetsService.resetToken(user.id, type);
  }
}
