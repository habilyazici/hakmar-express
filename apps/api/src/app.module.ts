import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuthModule } from './auth';
import { CacheModule } from './cache';
import { CatalogModule } from './catalog';
import { ChartsModule } from './charts';
import {
  AllExceptionsFilter,
  JwtAuthGuard,
  RolesGuard,
  TransformInterceptor,
} from './common';
import { validateEnv } from './config';
import { DashboardModule } from './dashboard';
import { GeoModule } from './geo';
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
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
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
    PeopleModule,
    UsersModule,
    TransactionsModule,
  ],
  controllers: [AppController],
  providers: [
    // Order matters: rate-limit, then authenticate, then authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
