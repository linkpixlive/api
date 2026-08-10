import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { WithdrawalEntity } from 'src/modules/withdrawals/entities/withdrawal.entity';
import { VerifyUserDto } from '../dto/verify-user.dto';
import { AdminUsersService } from '../services/admin-users.service';
import { AdminWithdrawalsService } from '../services/admin-withdrawals.service';

@ApiTags('Admin')
@Roles(UserRole.admin)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminWithdrawalsService: AdminWithdrawalsService,
    private readonly adminUsersService: AdminUsersService,
  ) {}

  @Patch('withdrawals/:id/approve')
  @ApiOperation({ summary: 'Aprovar um saque pendente' })
  @ApiResponse({
    status: 200,
    type: WithdrawalEntity,
    description: 'Saque aprovado com sucesso.',
  })
  @ApiResponse({ status: 400, description: 'O saque não está pendente.' })
  @ApiResponse({ status: 404, description: 'Saque não encontrado.' })
  approveWithdrawal(@Param('id') id: string) {
    return this.adminWithdrawalsService.approve(id);
  }

  @Patch('withdrawals/:id/reject')
  @ApiOperation({ summary: 'Rejeitar um saque pendente' })
  @ApiResponse({
    status: 200,
    type: WithdrawalEntity,
    description: 'Saque rejeitado com sucesso.',
  })
  @ApiResponse({ status: 400, description: 'O saque não está pendente.' })
  @ApiResponse({ status: 404, description: 'Saque não encontrado.' })
  rejectWithdrawal(@Param('id') id: string) {
    return this.adminWithdrawalsService.reject(id);
  }

  @Patch('users/:id/verify')
  @ApiOperation({ summary: 'Verificar/desverificar um usuário (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Status de verificação atualizado com sucesso.',
  })
  @ApiResponse({ status: 400, description: 'Usuário não encontrado.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 403, description: 'Sem permissão.' })
  verifyUser(@Param('id') id: string, @Body() verifyUserDto: VerifyUserDto) {
    return this.adminUsersService.verifyUser(id, verifyUserDto);
  }
}
