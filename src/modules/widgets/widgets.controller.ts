import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WidgetType } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/isPublic';
import { SafeUser } from 'src/modules/auth/entities/safe-user.entity';
import { UpdateWidgetDto } from './dto/update-widget.dto';
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
    @Param('type') type: WidgetType,
  ) {
    return this.widgetsService.getWidgetSettings(user.id, type);
  }

  @Patch(':type')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update settings for a specific widget type' })
  @ApiResponse({ status: 200, description: 'Widget settings updated' })
  async updateSettings(
    @CurrentUser() user: SafeUser,
    @Param('type') type: WidgetType,
    @Body() updateWidgetDto: UpdateWidgetDto,
  ) {
    return this.widgetsService.updateWidgetSettings(
      user.id,
      type,
      updateWidgetDto,
    );
  }

  @Public()
  @Get('public/:type/:key')
  @ApiOperation({ summary: 'Get public widget settings for OBS/External use' })
  async getPublicSettings(
    @Param('type') type: WidgetType,
    @Param('key') key: string,
  ) {
    return this.widgetsService.getPublicWidgetSettings(key, type);
  }

  @Post('overlay/test')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a test notification to the overlay' })
  async testOverlay(@CurrentUser() user: SafeUser) {
    return this.widgetsService.testOverlay(user.id);
  }
}
