import { Module } from '@nestjs/common';
import { SecurityService } from 'src/common/security/security.service';
import { GatewayModule } from 'src/infra/gateway/gateway.module';
import { AdminController } from './controllers/admin.controller';
import { AdminUsersService } from './services/admin-users.service';
import { AdminWithdrawalsService } from './services/admin-withdrawals.service';

@Module({
  imports: [GatewayModule],
  controllers: [AdminController],
  providers: [AdminWithdrawalsService, AdminUsersService, SecurityService],
})
export class AdminModule {}
