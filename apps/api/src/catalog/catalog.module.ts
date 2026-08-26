import { Module } from '@nestjs/common';
import {
  BrandsController,
  CategoriesController,
  ProductsController,
  SubcategoriesController,
} from './catalog.controller';
import {
  BrandsService,
  CategoriesService,
  ProductsService,
  SubcategoriesService,
} from './catalog.service';

@Module({
  controllers: [
    CategoriesController,
    SubcategoriesController,
    BrandsController,
    ProductsController,
  ],
  providers: [
    CategoriesService,
    SubcategoriesService,
    BrandsService,
    ProductsService,
  ],
})
export class CatalogModule {}
