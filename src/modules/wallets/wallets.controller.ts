import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import * as SafeUserEntity from '../auth/entities/safe-user.entity';
import { WalletsService } from './wallets.service';

type SafeUser = SafeUserEntity.SafeUser;

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('balances')
  @ApiOperation({ summary: 'Get the current user balance summary' })
  @ApiResponse({
    status: 200,
    description: 'Balance summary returned successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Wallet not found.',
  })
  getBalances(@CurrentUser() user: SafeUser) {
    return this.walletsService.getBalances(user);
  }
}
