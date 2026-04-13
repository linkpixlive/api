import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async setWithExpire(key: string, expiresIn: number, data: unknown) {
    await this.redis.setex(key, expiresIn, JSON.stringify(data));
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  async remove(key: string) {
    await this.redis.del(key);
  }

  async update(key: string, data: unknown): Promise<boolean> {
    const remainingTtl = await this.redis.ttl(key);

    if (remainingTtl <= 0) {
      return false;
    }

    await this.redis.set(key, JSON.stringify(data), 'EX', remainingTtl);
    return true;
  }
}
