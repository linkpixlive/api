import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ListWithdrawalsQueryDto } from './dto/list-withdrawals-query.dto';
import { WithdrawalEntity } from './entities/withdrawal.entity';
import { WithdrawalsService } from './withdrawals.service';

@ApiTags('Withdrawals')
@ApiBearerAuth()
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Post()
  @ApiOperation({ summary: 'Solicitar um novo saque' })
  @ApiResponse({
    status: 201,
    type: WithdrawalEntity,
    description: 'Saque solicitado com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Saldo insuficiente ou valor inválido.',
  })
  @ApiResponse({
    status: 404,
    description: 'Chave Pix não encontrada.',
  })
  create(
    @CurrentUser() user: SafeUser,
    @Body() createWithdrawalDto: CreateWithdrawalDto,
  ) {
    return this.withdrawalsService.create(user, createWithdrawalDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar histórico de saques com filtros' })
  @ApiResponse({
    status: 200,
    type: WithdrawalEntity,
    description: 'Lista de saques retornada com sucesso.',
  })
  findAll(
    @CurrentUser() user: SafeUser,
    @Query() query: ListWithdrawalsQueryDto,
  ) {
    return this.withdrawalsService.findAll(user, query);
  }
}
