import { Global, Module } from '@nestjs/common';
import { SecurityService } from './security.service';

@Global()
@Module({
  providers: [SecurityService],
})
export class SecurityModule {}
