import { Global, Logger, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    RedisService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        const redis = new Redis(redisUrl);
        const logger = new Logger(RedisModule.name);
        redis.on('error', (err) => logger.warn(`Redis: ${err.message}`));
        return redis;
      },
    },
  ],
  exports: [RedisService, 'REDIS_CLIENT'],
})
export class RedisModule {}
