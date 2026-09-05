import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async setWithExpire(key: string, expiresIn: number, data: unknown) {
    await this.redis.setex(key, expiresIn, JSON.stringify(data));
  }

  async setIfNotExists(
    key: string,
    expiresIn: number,
    data: unknown,
  ): Promise<boolean> {
    const result = await this.redis.set(
      key,
      JSON.stringify(data),
      'EX',
      expiresIn,
      'NX',
    );
    return result === 'OK';
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

  async setExpire(key: string, seconds: number) {
    await this.redis.expire(key, seconds);
  }

  async addToList(key: string, value: string) {
    await this.redis.sadd(key, value);
  }

  async getList(key: string): Promise<string[]> {
    return await this.redis.smembers(key);
  }

  async removeFromList(key: string, value: string) {
    await this.redis.srem(key, value);
  }

  async addToListEnd(key: string, value: string) {
    await this.redis.rpush(key, value);
  }

  async addToListStart(key: string, value: string) {
    await this.redis.lpush(key, value);
  }

  async removeFromListStart(key: string): Promise<string | null> {
    return await this.redis.lpop(key);
  }

  async removeListValue(key: string, value: string) {
    await this.redis.lrem(key, 0, value);
  }

  async getListLength(key: string): Promise<number> {
    return await this.redis.llen(key);
  }

  async getListRange(
    key: string,
    start: number,
    stop: number,
  ): Promise<string[]> {
    return await this.redis.lrange(key, start, stop);
  }
}
