import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth';
import { CacheModule } from './cache';
import { CatalogModule } from './catalog';
import { ChartsModule } from './charts';
import {
  AllExceptionsFilter,
  GLOBAL_THROTTLE,
  JwtAuthGuard,
  RequestContextMiddleware,
  RolesGuard,
  TransformInterceptor,
} from './common';
import { validateEnv } from './config';
import { DashboardModule } from './dashboard';
import { GeoModule } from './geo';
import { HealthModule } from './health';
import { KdsModule } from './kds';
import { PeopleModule } from './people';
import { PrismaModule } from './prisma';
import { SpatialForecastModule } from './spatial-forecast';
import { TablesModule } from './tables';
import { TransactionsModule } from './transactions';
import { UsersModule } from './users';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // The limit every route inherits unless it declares its own; see
    // common/env/rate-limits.ts for why it is configurable.
    ThrottlerModule.forRoot([GLOBAL_THROTTLE]),
    PrismaModule,
    CacheModule,
    AuthModule,
    DashboardModule,
    ChartsModule,
    TablesModule,
    KdsModule,
    SpatialForecastModule,
    CatalogModule,
    GeoModule,
    HealthModule,
    PeopleModule,
    UsersModule,
    TransactionsModule,
  ],
  providers: [
    // Order matters: rate-limit, then authenticate, then authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  /**
   * Middleware rather than an interceptor, so it also covers the requests
   * that never reach a handler — a 404, and anything a guard rejects, which
   * is where the throttler's 429s live.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
