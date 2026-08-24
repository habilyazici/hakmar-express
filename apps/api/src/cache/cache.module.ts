import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';

/**
 * Global Redis-backed cache. The legacy app rolled two parallel, ad-hoc
 * caches (an in-memory Map in cacheService.js — whose own comment said
 * "Redis kaldırıldı", Redis was removed — and a MySQL `dashboard_cache`
 * table with no TTL). This replaces both with a single, real cache with
 * proper expiry, reached the same way (@CacheKey/@CacheTTL + CacheInterceptor,
 * or CACHE_MANAGER injection) from every module.
 */
@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [createKeyv(config.getOrThrow<string>('REDIS_URL'))],
      }),
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
