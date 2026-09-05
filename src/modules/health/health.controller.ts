import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/common/decorators/isPublic';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @Throttle({ health_check: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Health check da aplicação.' })
  @ApiResponse({
    status: 200,
    description: 'Aplicação saudável e aceitando conexões.',
  })
  check() {
    return { status: 'ok' };
  }
}
