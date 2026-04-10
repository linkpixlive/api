import { Module } from '@nestjs/common';
import { SecurityService } from '../../common/security/security.service';
import { PixKeysController } from './pix-keys.controller';
import { PixKeysService } from './pix-keys.service';

@Module({
  controllers: [PixKeysController],
  providers: [PixKeysService, SecurityService],
})
export class PixKeysModule {}
