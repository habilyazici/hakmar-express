import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  CacheInvalidationInterceptor,
  PaginationQueryDto,
  Role,
  Roles,
} from '../common';
import {
  BrandsService,
  CategoriesService,
  ProductsService,
  SubcategoriesService,
} from './catalog.service';
import {
  CreateBrandDto,
  CreateCategoryDto,
  CreateProductDto,
  CreateSubcategoryDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpdateSubcategoryDto,
} from './dto/catalog.dto';

const READ = [Role.SUPERADMIN, Role.ADMIN, Role.ANALYST] as const;
const WRITE = [Role.SUPERADMIN, Role.ADMIN] as const;

@Controller('catalog/categories')
@UseInterceptors(CacheInvalidationInterceptor)
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Roles(...READ)
  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.service.list(
      query.limit ?? 50,
      query.offset ?? 0,
      query.search,
    );
  }

  @Roles(...READ)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Roles(...WRITE)
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.service.create(dto);
  }

  @Roles(...WRITE)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.update(id, dto);
  }

  @Roles(...WRITE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

@Controller('catalog/subcategories')
@UseInterceptors(CacheInvalidationInterceptor)
export class SubcategoriesController {
  constructor(private readonly service: SubcategoriesService) {}

  @Roles(...READ)
  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.service.list(
      query.limit ?? 50,
      query.offset ?? 0,
      query.search,
    );
  }

  @Roles(...READ)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Roles(...WRITE)
  @Post()
  create(@Body() dto: CreateSubcategoryDto) {
    return this.service.create(dto);
  }

  @Roles(...WRITE)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubcategoryDto,
  ) {
    return this.service.update(id, dto);
  }

  @Roles(...WRITE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

/** Keyed by a string `code`, so no ParseIntPipe on the path parameter. */
@Controller('catalog/brands')
@UseInterceptors(CacheInvalidationInterceptor)
export class BrandsController {
  constructor(private readonly service: BrandsService) {}

  @Roles(...READ)
  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.service.list(
      query.limit ?? 50,
      query.offset ?? 0,
      query.search,
    );
  }

  @Roles(...READ)
  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.service.findOne(code);
  }

  @Roles(...WRITE)
  @Post()
  create(@Body() dto: CreateBrandDto) {
    return this.service.create(dto);
  }

  @Roles(...WRITE)
  @Patch(':code')
  update(@Param('code') code: string, @Body() dto: UpdateBrandDto) {
    return this.service.update(code, dto);
  }

  @Roles(...WRITE)
  @Delete(':code')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('code') code: string) {
    return this.service.remove(code);
  }
}

@Controller('catalog/products')
@UseInterceptors(CacheInvalidationInterceptor)
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Roles(...READ)
  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.service.list(
      query.limit ?? 50,
      query.offset ?? 0,
      query.search,
    );
  }

  @Roles(...READ)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Roles(...WRITE)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Roles(...WRITE)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }

  @Roles(...WRITE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
