import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async setWithExpire(key: string, expiresIn: number, data: any) {
    await this.redis.setex(key, expiresIn, JSON.stringify(data));
  }

  async get<T>(key: string): Promise<T> {
    const data = await this.redis.get(key);
    return data ? (JSON.parse(data) as T) : ({} as T);
  }

  async remove(key: string) {
    await this.redis.del(key);
  }

  async update(key: string, data: any) {
    // 1. Pega o tempo que falta para expirar (em segundos)
    const remainingTtl = await this.redis.ttl(key);

    // Se o TTL for -2, a chave não existe. Se for -1, não tem expiração.
    if (remainingTtl > 0) {
      await this.redis.set(key, JSON.stringify(data), 'EX', remainingTtl);
    } else {
      // Se a chave não tinha TTL ou não existia, decide se salva normal
      await this.redis.set(key, JSON.stringify(data));
    }
  }
}
