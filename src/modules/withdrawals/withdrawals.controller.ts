import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import * as SafeUserEntity from '../auth/entities/safe-user.entity';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ListWithdrawalsQueryDto } from './dto/list-withdrawals-query.dto';
import { WithdrawalsService } from './withdrawals.service';

type SafeUser = SafeUserEntity.SafeUser;

@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Post()
  @ApiOperation({ summary: 'Request a new withdrawal' })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal request submitted successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient balance or invalid amount.',
  })
  @ApiResponse({
    status: 404,
    description: 'Pix key not found.',
  })
  create(
    @CurrentUser() user: SafeUser,
    @Body() createWithdrawalDto: CreateWithdrawalDto,
  ) {
    return this.withdrawalsService.create(user, createWithdrawalDto);
  }

  @Get()
  @ApiOperation({ summary: 'List withdrawal history with filters' })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal history returned successfully.',
  })
  findAll(
    @CurrentUser() user: SafeUser,
    @Query() query: ListWithdrawalsQueryDto,
  ) {
    return this.withdrawalsService.findAll(user, query);
  }
}
