import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { WalletBalancesEntity } from './entities/wallet-balances.entity';
import { WalletsService } from './wallets.service';

@ApiTags('Wallets')
@ApiBearerAuth()
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('balances')
  @ApiOperation({ summary: 'Get the current user balance summary' })
  @ApiResponse({
    status: 200,
    type: WalletBalancesEntity,
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
