import { Module } from '@nestjs/common';
import {
  BranchesController,
  CitiesController,
  RegionsController,
} from './geo.controller';
import { BranchesService, CitiesService, RegionsService } from './geo.services';

@Module({
  controllers: [RegionsController, CitiesController, BranchesController],
  providers: [RegionsService, CitiesService, BranchesService],
})
export class GeoModule {}
