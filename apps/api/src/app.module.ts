import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import { CatalogModule } from './catalog/catalog.module';
import { ChartsModule } from './charts/charts.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { validateEnv } from './config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { DashboardModule } from './dashboard/dashboard.module';
import { GeoModule } from './geo/geo.module';
import { KdsModule } from './kds/kds.module';
import { PeopleModule } from './people/people.module';
import { PrismaModule } from './prisma/prisma.module';
import { SpatialForecastModule } from './spatial-forecast/spatial-forecast.module';
import { TablesModule } from './tables/tables.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

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
