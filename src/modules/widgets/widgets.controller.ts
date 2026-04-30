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
import { WidgetsService } from './widgets.service';

@ApiTags('Widgets')
@Controller('widgets')
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get(':type')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get settings for a specific widget type' })
  @ApiResponse({ status: 200, description: 'Widget settings retrieved' })
  async getSettings(
    @CurrentUser() user: SafeUser,
    @Param() { type }: WidgetTypeParams,
  ) {
    return this.widgetsService.getWidgetSettings(user.id, type);
  }

  @Post(':type')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create settings for a specific widget type' })
  @ApiResponse({ status: 201, description: 'Widget settings created' })
  async createSettings(
    @CurrentUser() user: SafeUser,
    @Param() { type }: WidgetTypeParams,
    @Body(WidgetSettingsPipe) settings: AnyWidgetSettings,
  ) {
    return this.widgetsService.createWidgetSettings(user.id, type, settings);
  }

  @Put(':type')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update settings for a specific widget type' })
  @ApiResponse({ status: 200, description: 'Widget settings updated' })
  async updateSettings(
    @CurrentUser() user: SafeUser,
    @Param() { type }: WidgetTypeParams,
    @Body(WidgetSettingsPipe) settings: AnyWidgetSettings,
  ) {
    return this.widgetsService.updateWidgetSettings(user, type, settings);
  }

  @Public()
  @Get('public/:type/:key')
  @ApiOperation({ summary: 'Get public widget settings for OBS/External use' })
  async getPublicSettings(@Param() { type, key }: PublicWidgetParams) {
    return this.widgetsService.getPublicWidgetSettings(key, type);
  }

  @Post('overlay/test')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a test notification to the overlay' })
  async testOverlay(@CurrentUser() user: SafeUser) {
    return this.widgetsService.testOverlay(user.id);
  }
}
