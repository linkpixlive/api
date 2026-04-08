import { Module } from '@nestjs/common';
import { PixKeysController } from './pix-keys.controller';
import { PixKeysService } from './pix-keys.service';

@Module({
  controllers: [PixKeysController],
  providers: [PixKeysService],
})
export class PixKeysModule {}
