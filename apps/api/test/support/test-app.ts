import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Cache } from 'cache-manager';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/setup-app';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  setupApp(app);
  await app.init();
  return app;
}

/**
 * Empties the response cache.
 *
 * Every suite seeds its fixtures straight through Prisma, which the API never
 * sees — so the cache-invalidation interceptor does not fire and the
 * analytics endpoints can still be holding a response from before those rows
 * existed. Suites share one Redis, so whether that bites depends on which
 * suite ran first, which made failures look random. Call this at the end of
 * any `beforeAll` that seeds data and then asserts against a cached endpoint.
 */
export async function clearCache(app: INestApplication): Promise<void> {
  await app.get<Cache>(CACHE_MANAGER).clear();
}

export function agent(app: INestApplication) {
  return request(app.getHttpServer() as App);
}
