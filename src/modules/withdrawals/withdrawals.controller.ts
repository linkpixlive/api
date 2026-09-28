import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ListWithdrawalsQueryDto } from './dto/list-withdrawals-query.dto';
import { WithdrawalEntity } from './entities/withdrawal.entity';
import { PaginatedWithdrawalResponse } from './entities/paginated-withdrawal.entity';
import { WithdrawalsService } from './withdrawals.service';

@ApiTags('Withdrawals')
@ApiBearerAuth()
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @ApiOperation({ summary: 'Solicitar um novo saque' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Chave de idempotência gerada pelo cliente (ex.: UUID por clique) para evitar saques duplicados',
  })
  @ApiResponse({
    status: 201,
    type: WithdrawalEntity,
    description: 'Saque solicitado com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Saldo insuficiente, valor inválido ou Idempotency-Key ausente.',
  })
  @ApiResponse({
    status: 404,
    description: 'Chave Pix não encontrada.',
  })
  @ApiResponse({
    status: 409,
    description: 'Idempotency-Key já utilizada com outro valor ou chave Pix.',
  })
  create(
    @CurrentUser() user: SafeUser,
    @Body() createWithdrawalDto: CreateWithdrawalDto,
    @Headers('idempotency-key') clientKey: string,
  ) {
    if (!clientKey) {
      throw new BadRequestException(
        'Idempotency-Key é obrigatório para solicitar um saque.',
      );
    }
    if (clientKey.length > 128) {
      throw new BadRequestException(
        'Idempotency-Key deve ter no máximo 128 caracteres.',
      );
    }
    return this.withdrawalsService.create(user, createWithdrawalDto, clientKey);
  }

  @Get()
  @ApiOperation({ summary: 'Listar histórico de saques com filtros' })
  @ApiResponse({
    status: 200,
    type: PaginatedWithdrawalResponse,
    description: 'Lista de saques retornada com sucesso.',
  })
  findAll(
    @CurrentUser() user: SafeUser,
    @Query() query: ListWithdrawalsQueryDto,
  ) {
    return this.withdrawalsService.findAll(user, query);
  }
}
