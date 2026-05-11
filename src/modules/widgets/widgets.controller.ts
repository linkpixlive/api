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

  @Get(':type')
  @ApiOperation({ summary: 'Get settings for a specific widget type' })
  @ApiResponse({ status: 200, type: WidgetEntity })
  async getSettings(
    @CurrentUser() user: SafeUser,
    @Param() { type }: WidgetTypeParams,
  ) {
    return this.widgetsService.getWidgetSettings(user.id, type);
  }

  @Post(':type')
  @ApiOperation({ summary: 'Create settings for a specific widget type' })
  @ApiResponse({ status: 201, type: WidgetEntity })
  async createSettings(
    @CurrentUser() user: SafeUser,
    @Param() { type }: WidgetTypeParams,
    @Body(WidgetSettingsPipe) settings: AnyWidgetSettings,
  ) {
    return this.widgetsService.createWidgetSettings(user.id, type, settings);
  }

  @Put(':type')
  @ApiOperation({ summary: 'Update settings for a specific widget type' })
  @ApiResponse({ status: 200, type: WidgetEntity })
  async updateSettings(
    @CurrentUser() user: SafeUser,
    @Param() { type }: WidgetTypeParams,
    @Body(WidgetSettingsPipe) settings: AnyWidgetSettings,
  ) {
    return this.widgetsService.updateWidgetSettings(user, type, settings);
  }

  @Public()
  @Get('public/:type/:token')
  @ApiOperation({ summary: 'Get public widget settings for OBS/External use' })
  @ApiResponse({ status: 200 })
  async getPublicSettings(@Param() { token }: PublicWidgetParams) {
    return this.widgetsService.getPublicWidgetSettings(token);
  }

  @Post(':type/reset-token')
  @ApiOperation({ summary: 'Reset the token for a specific widget type' })
  @ApiResponse({ status: 200, type: WidgetEntity })
  async resetToken(
    @CurrentUser() user: SafeUser,
    @Param() { type }: WidgetTypeParams,
  ) {
    return this.widgetsService.resetToken(user.id, type);
  }
}
