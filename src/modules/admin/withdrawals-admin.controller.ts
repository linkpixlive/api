import { Controller, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';

@ApiTags('Admin')
@Controller('admin/withdrawals')
@Roles(UserRole.admin)
export class WithdrawalsAdminController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending withdrawal' })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal approved successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Withdrawal is not pending.',
  })
  @ApiResponse({
    status: 404,
    description: 'Withdrawal not found.',
  })
  approve(@Param('id') id: string) {
    return this.withdrawalsService.approve(id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending withdrawal' })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal rejected successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Withdrawal is not pending.',
  })
  @ApiResponse({
    status: 404,
    description: 'Withdrawal not found.',
  })
  reject(@Param('id') id: string) {
    return this.withdrawalsService.reject(id);
  }
}
