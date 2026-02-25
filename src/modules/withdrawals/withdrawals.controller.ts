import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UpdateWithdrawalDto } from './dto/update-withdrawal.dto';
import { WithdrawalsService } from './withdrawals.service';

@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Post()
  create(@Body() createWithdrawalDto: CreateWithdrawalDto) {
    return this.withdrawalsService.create(createWithdrawalDto);
  }

  @Get()
  findAll() {
    return this.withdrawalsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.withdrawalsService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateWithdrawalDto: UpdateWithdrawalDto,
  ) {
    return this.withdrawalsService.update(+id, updateWithdrawalDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.withdrawalsService.remove(+id);
  }
}
