import { ClassSerializerInterceptor, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import type Redis from 'ioredis';
import request from 'supertest';
import { App } from 'supertest/types';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor';
import { PrismaService } from './../src/infra/db/prisma.service';
import { AppModule } from './../src/app.module';

describe('Smoke (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    const reflector = app.get(Reflector);
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(reflector),
      new ResponseInterceptor(),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await app.get<Redis>('REDIS_CLIENT').quit();
    await app.get(PrismaService).$disconnect();
  });

  it('GET /health responde 200 com o envelope padrão', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          success: true,
          data: { status: 'ok' },
        });
      });
  });

  it('SELECT 1 via PrismaService valida DATABASE_URL e migrações em runtime', async () => {
    const prisma = app.get(PrismaService);
    const result =
      await prisma.$queryRawUnsafe<Array<{ ok: number }>>('SELECT 1 AS ok');
    expect(Number(result[0]?.ok)).toBe(1);
  });
});
