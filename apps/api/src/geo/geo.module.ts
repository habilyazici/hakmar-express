import { Module } from '@nestjs/common';
import {
  BranchesController,
  CitiesController,
  RegionsController,
} from './geo.controller';
import { GeoJsonController } from './geojson.controller';
import { GeoJsonService } from './geojson.service';
import { BranchesService, CitiesService, RegionsService } from './geo.service';

@Module({
  controllers: [
    RegionsController,
    CitiesController,
    BranchesController,
    GeoJsonController,
  ],
  providers: [RegionsService, CitiesService, BranchesService, GeoJsonService],
})
export class GeoModule {}
