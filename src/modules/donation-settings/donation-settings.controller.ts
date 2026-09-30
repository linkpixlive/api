import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/modules/auth/types/authenticated-user';
import { DonationSettingsService } from './donation-settings.service';
import { UpdateDonationSettingsDto } from './dto/update-donation-settings.dto';
import { DonationSettingsEntity } from './entities/donation-settings.entity';

@ApiTags('Settings')
@Controller('donation-settings')
export class DonationSettingsController {
  constructor(
    private readonly donationSettingsService: DonationSettingsService,
  ) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter regras de doação do usuário atual' })
  @ApiResponse({
    status: 200,
    type: DonationSettingsEntity,
    description: 'Configurações de doação recuperadas com sucesso',
  })
  async getMySettings(@CurrentUser() user: AuthenticatedUser) {
    return this.donationSettingsService.getSettings(user.id);
  }

  @Patch()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar regras de doação' })
  @ApiResponse({
    status: 200,
    type: DonationSettingsEntity,
    description: 'Configurações de doação atualizadas com sucesso',
  })
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateDonationSettingsDto: UpdateDonationSettingsDto,
  ) {
    return this.donationSettingsService.updateSettings(
      user.id,
      updateDonationSettingsDto,
    );
  }
}
