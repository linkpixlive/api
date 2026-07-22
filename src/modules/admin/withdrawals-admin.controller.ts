import { Controller, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';
import { WithdrawalEntity } from '../withdrawals/entities/withdrawal.entity';

@ApiTags('Admin')
@Controller('admin/withdrawals')
@Roles(UserRole.admin)
export class WithdrawalsAdminController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Aprovar um saque pendente' })
  @ApiResponse({
    status: 200,
    type: WithdrawalEntity,
    description: 'Saque aprovado com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'O saque não está pendente.',
  })
  @ApiResponse({
    status: 404,
    description: 'Saque não encontrado.',
  })
  approve(@Param('id') id: string) {
    return this.withdrawalsService.approve(id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Rejeitar um saque pendente' })
  @ApiResponse({
    status: 200,
    type: WithdrawalEntity,
    description: 'Saque rejeitado com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'O saque não está pendente.',
  })
  @ApiResponse({
    status: 404,
    description: 'Saque não encontrado.',
  })
  reject(@Param('id') id: string) {
    return this.withdrawalsService.reject(id);
  }
}
