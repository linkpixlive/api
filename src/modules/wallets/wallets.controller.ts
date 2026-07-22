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
  @ApiOperation({ summary: 'Obter o resumo de saldo do usuário' })
  @ApiResponse({
    status: 200,
    type: WalletBalancesEntity,
    description: 'Resumo de saldo retornado com sucesso.',
  })
  @ApiResponse({
    status: 404,
    description: 'Carteira não encontrada.',
  })
  getBalances(@CurrentUser() user: SafeUser) {
    return this.walletsService.getBalances(user);
  }
}
