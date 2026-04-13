import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/common/decorators/isPublic';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data (email already exists, format, etc).',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests.',
  })
  @Throttle({
    burst: { limit: 1, ttl: 1000 },
    registration_limit: { limit: 3, ttl: 900000 },
  })
  register(@Body() registerAuthDto: RegisterAuthDto) {
    return this.authService.register(registerAuthDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login a user' })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials.',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests.',
  })
  @Throttle({
    burst: { limit: 2, ttl: 1000 },
    login_limit: { limit: 10, ttl: 300000 },
  })
  login(@Body() loginAuthDto: LoginAuthDto) {
    return this.authService.login(loginAuthDto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Forgot password' })
  @ApiResponse({
    status: 200,
    description: 'Email with password change link sent successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data (email format, etc).',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials (email not found, etc).',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests.',
  })
  @Throttle({
    recovery_limit: { limit: 4, ttl: 900000 },
  })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data (password format, etc).',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials (token expired, already used, etc).',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests.',
  })
  @Throttle({
    recovery_limit: { limit: 4, ttl: 900000 },
  })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP' })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data (OTP format, etc).',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials (OTP expired, already used, etc).',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests.',
  })
  @Throttle({
    recovery_limit: { limit: 4, ttl: 900000 },
  })
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }
}
