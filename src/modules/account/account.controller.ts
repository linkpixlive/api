import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentSid } from 'src/common/decorators/current-sid.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { AccountService } from './account.service';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmEmailChangeDto } from './dto/confirm-email-change.dto';
import { DeactivateAccountDto } from './dto/deactivate-account.dto';
import { Disable2faDto } from './dto/disable-2fa.dto';
import { Enable2faDto } from './dto/enable-2fa.dto';
import { Setup2faDto } from './dto/setup-2fa.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateProfileResponseDto } from './dto/update-profile-response.dto';
import { MessageDto } from 'src/common/dto/message.dto';
import { AccountEntity } from './entities/account.entity';
import { Setup2faEntity } from './entities/setup-2fa.entity';

@ApiTags('Account')
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOperation({ summary: 'Obter configurações da conta' })
  @ApiResponse({
    status: 200,
    type: AccountEntity,
    description: 'Configurações da conta retornadas com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  getSettings(@CurrentUser() user: SafeUser) {
    return this.accountService.getSettings(user);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Atualizar perfil (nome e campos simples)' })
  @ApiResponse({
    status: 200,
    type: UpdateProfileResponseDto,
    description: 'Perfil atualizado com sucesso.',
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  updateProfile(@CurrentUser() user: SafeUser, @Body() dto: UpdateProfileDto) {
    return this.accountService.updateProfile(user.id, dto);
  }

  @Patch('email')
  @ApiOperation({ summary: 'Solicitar alteração de email' })
  @ApiResponse({
    status: 200,
    type: MessageDto,
    description: 'Código de confirmação enviado para o novo email.',
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  @ApiResponse({
    status: 401,
    description: 'Senha ou código TOTP inválidos.',
  })
  @ApiResponse({ status: 409, description: 'Email já está em uso.' })
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  changeEmail(
    @CurrentUser() user: SafeUser,
    @CurrentSid() sid: string,
    @Body() dto: ChangeEmailDto,
  ) {
    return this.accountService.changeEmail(user, sid, dto);
  }

  @Post('email/verify')
  @ApiOperation({ summary: 'Confirmar alteração de email' })
  @ApiResponse({
    status: 201,
    type: MessageDto,
    description: 'Email atualizado com sucesso.',
  })
  @ApiResponse({ status: 400, description: 'Código inválido ou expirado.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 409, description: 'Email já está em uso.' })
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  confirmEmailChange(
    @CurrentUser() user: SafeUser,
    @CurrentSid() sid: string,
    @Body() dto: ConfirmEmailChangeDto,
  ) {
    return this.accountService.confirmEmailChange(user, sid, dto);
  }

  @Patch('password')
  @ApiOperation({ summary: 'Atualizar senha' })
  @ApiResponse({
    status: 200,
    type: MessageDto,
    description: 'Senha alterada com sucesso.',
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas.' })
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  changePassword(
    @CurrentUser() user: SafeUser,
    @CurrentSid() sid: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.accountService.changePassword(user, dto, sid);
  }

  @Patch('deactivate')
  @ApiOperation({ summary: 'Desativar conta' })
  @ApiResponse({
    status: 200,
    type: MessageDto,
    description: 'Conta desativada com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas.' })
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  deactivateAccount(
    @CurrentUser() user: SafeUser,
    @Body() dto: DeactivateAccountDto,
  ) {
    return this.accountService.deactivateAccount(user, dto);
  }

  @Post('2fa/setup')
  @ApiOperation({ summary: 'Iniciar configuração do 2FA (TOTP)' })
  @ApiResponse({
    status: 200,
    type: Setup2faEntity,
    description:
      'Secret e otpauthUrl retornados para o frontend renderizar o QR.',
  })
  @ApiResponse({ status: 400, description: '2FA já está ativo.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  setup2fa(@CurrentUser() user: SafeUser, @Body() dto: Setup2faDto) {
    return this.accountService.setup2fa(user, dto);
  }

  @Post('2fa/enable')
  @ApiOperation({ summary: 'Ativar 2FA validando o primeiro código TOTP' })
  @ApiResponse({
    status: 200,
    type: MessageDto,
    description: '2FA ativado com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Código inválido ou setup expirado.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  enable2fa(
    @CurrentUser() user: SafeUser,
    @CurrentSid() sid: string,
    @Body() dto: Enable2faDto,
  ) {
    return this.accountService.enable2fa(user.id, sid, dto);
  }

  @Post('2fa/disable')
  @ApiOperation({ summary: 'Desativar 2FA' })
  @ApiResponse({
    status: 200,
    type: MessageDto,
    description: '2FA desativado.',
  })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas.' })
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  disable2fa(@CurrentUser() user: SafeUser, @Body() dto: Disable2faDto) {
    return this.accountService.disable2fa(user, dto);
  }
}
