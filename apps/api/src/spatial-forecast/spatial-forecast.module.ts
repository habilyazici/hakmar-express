import { Module } from '@nestjs/common';
import { SpatialForecastController } from './spatial-forecast.controller';
import { SpatialForecastService } from './spatial-forecast.service';

@Module({
  controllers: [SpatialForecastController],
  providers: [SpatialForecastService],
})
export class SpatialForecastModule {}
