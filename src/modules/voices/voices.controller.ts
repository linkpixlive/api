import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/common/decorators/isPublic';
import { PublicVoiceEntity } from './entities/public-voice.entity';
import { VoicesService } from './voices.service';

@ApiTags('Voices')
@Controller('voices')
export class VoicesPublicController {
  constructor(private readonly voicesService: VoicesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Listar vozes ativas (público)' })
  @ApiResponse({ status: 200, type: [PublicVoiceEntity] })
  @Throttle({
    burst: { limit: 20, ttl: 10000 },
  })
  findActive() {
    return this.voicesService.findActivePublic();
  }
}
