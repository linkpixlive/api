import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentSid } from 'src/common/decorators/current-sid.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/isPublic';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SafeUser } from './entities/safe-user.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrar um novo usuário' })
  @ApiResponse({
    status: 201,
    description: 'Usuário registrado com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos (email já existe, formato, etc).',
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas solicitações.',
  })
  @Throttle({
    burst: { limit: 1, ttl: 1000 },
    registration_limit: { limit: 3, ttl: 900000 },
  })
  register(@Body() registerAuthDto: RegisterAuthDto) {
    return this.authService.register(registerAuthDto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Autenticar usuário' })
  @ApiResponse({
    status: 200,
    description: 'Usuário autenticado com sucesso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciais inválidas.',
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas solicitações.',
  })
  @Throttle({
    burst: { limit: 2, ttl: 1000 },
    login_limit: { limit: 10, ttl: 300000 },
  })
  login(@Body() loginAuthDto: LoginAuthDto) {
    return this.authService.login(loginAuthDto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Esqueci a senha' })
  @ApiResponse({
    status: 200,
    description: 'Email com link de redefinição de senha enviado com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos (formato de email, etc).',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciais inválidas (email não encontrado, etc).',
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas solicitações.',
  })
  @Throttle({
    recovery_limit: { limit: 4, ttl: 900000 },
  })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alterar senha' })
  @ApiResponse({
    status: 200,
    description: 'Senha alterada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos (formato de senha, etc).',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciais inválidas (token expirado, já utilizado, etc).',
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas solicitações.',
  })
  @Throttle({
    recovery_limit: { limit: 4, ttl: 900000 },
  })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar OTP' })
  @ApiResponse({
    status: 200,
    description: 'OTP verificado com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos (formato de OTP, etc).',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciais inválidas (OTP expirado, já utilizado, etc).',
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas solicitações.',
  })
  @Throttle({
    recovery_limit: { limit: 4, ttl: 900000 },
  })
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sair da sessão atual' })
  @ApiResponse({ status: 200, description: 'Sessão encerrada com sucesso.' })
  logout(@CurrentSid() sid: string, @CurrentUser() user: SafeUser) {
    return this.authService.logout(sid, user.id);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sair de todos os dispositivos' })
  @ApiResponse({ status: 200, description: 'Sessão encerrada em todos os dispositivos.' })
  logoutAll(@CurrentUser() user: SafeUser, @CurrentSid() sid: string) {
    return this.authService.logoutAll(user.id, sid);
  }
}
