import { Module } from '@nestjs/common';
import { StorageModule } from 'src/infra/storage/storage.module';
import { GatewayModule } from 'src/infra/gateway/gateway.module';
import { AdminController } from './controllers/admin.controller';
import { AdminVoicesController } from './controllers/admin-voices.controller';
import { AdminUsersService } from './services/admin-users.service';
import { AdminVoicesService } from './services/admin-voices.service';
import { AdminWithdrawalsService } from './services/admin-withdrawals.service';

@Module({
  imports: [GatewayModule, StorageModule],
  controllers: [AdminController, AdminVoicesController],
  providers: [AdminWithdrawalsService, AdminUsersService, AdminVoicesService],
})
export class AdminModule {}
