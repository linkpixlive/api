import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentSid } from 'src/common/decorators/current-sid.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { AccountSettingsService } from './account-settings.service';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeactivateAccountDto } from './dto/deactivate-account.dto';
import { Disable2faDto } from './dto/disable-2fa.dto';
import { Enable2faDto } from './dto/enable-2fa.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Account Settings')
@Controller('account-settings')
export class AccountSettingsController {
  constructor(
    private readonly accountSettingsService: AccountSettingsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Obter configurações da conta' })
  @ApiResponse({
    status: 200,
    description: 'Configurações da conta retornadas com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  getSettings(@CurrentUser() user: SafeUser) {
    return this.accountSettingsService.getSettings(user);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Atualizar perfil (nome e campos simples)' })
  @ApiResponse({ status: 200, description: 'Perfil atualizado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  updateProfile(@CurrentUser() user: SafeUser, @Body() dto: UpdateProfileDto) {
    return this.accountSettingsService.updateProfile(user.id, dto);
  }

  @Patch('email')
  @ApiOperation({ summary: 'Atualizar email' })
  @ApiResponse({ status: 200, description: 'Email atualizado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas.' })
  @ApiResponse({ status: 409, description: 'Email já está em uso.' })
  @Throttle({ email_change_limit: { limit: 3, ttl: 900000 } })
  changeEmail(@CurrentUser() user: SafeUser, @Body() dto: ChangeEmailDto) {
    return this.accountSettingsService.changeEmail(user, dto);
  }

  @Patch('password')
  @ApiOperation({ summary: 'Atualizar senha' })
  @ApiResponse({ status: 200, description: 'Senha alterada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas.' })
  @Throttle({ password_change_limit: { limit: 3, ttl: 900000 } })
  changePassword(
    @CurrentUser() user: SafeUser,
    @CurrentSid() sid: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.accountSettingsService.changePassword(user, dto, sid);
  }

  @Patch('deactivate')
  @ApiOperation({ summary: 'Desativar conta' })
  @ApiResponse({ status: 200, description: 'Conta desativada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas.' })
  @Throttle({ deactivation_limit: { limit: 3, ttl: 900000 } })
  deactivateAccount(
    @CurrentUser() user: SafeUser,
    @Body() dto: DeactivateAccountDto,
  ) {
    return this.accountSettingsService.deactivateAccount(user, dto);
  }

  @Post('2fa/setup')
  @ApiOperation({ summary: 'Iniciar configuração do 2FA (TOTP)' })
  @ApiResponse({
    status: 200,
    description:
      'Secret e otpauthUrl retornados para o frontend renderizar o QR.',
  })
  @ApiResponse({ status: 400, description: '2FA já está ativo.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @Throttle({ '2fa_limit': { limit: 5, ttl: 300000 } })
  setup2fa(@CurrentUser() user: SafeUser) {
    return this.accountSettingsService.setup2fa(user);
  }

  @Post('2fa/enable')
  @ApiOperation({ summary: 'Ativar 2FA validando o primeiro código TOTP' })
  @ApiResponse({ status: 200, description: '2FA ativado com sucesso.' })
  @ApiResponse({
    status: 400,
    description: 'Código inválido ou setup expirado.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @Throttle({ '2fa_limit': { limit: 5, ttl: 300000 } })
  enable2fa(@CurrentUser() user: SafeUser, @Body() dto: Enable2faDto) {
    return this.accountSettingsService.enable2fa(user.id, dto);
  }

  @Post('2fa/disable')
  @ApiOperation({ summary: 'Desativar 2FA' })
  @ApiResponse({ status: 200, description: '2FA desativado.' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas.' })
  @Throttle({ '2fa_limit': { limit: 5, ttl: 300000 } })
  disable2fa(@CurrentUser() user: SafeUser, @Body() dto: Disable2faDto) {
    return this.accountSettingsService.disable2fa(user, dto);
  }
}
