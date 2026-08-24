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
import { Role } from '../../generated/prisma/enums';
import { PaginationQueryDto } from '../common/crud/pagination.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CacheInvalidationInterceptor } from '../common/interceptors/cache-invalidation.interceptor';
import {
  CreateBranchDto,
  CreateCityDto,
  CreateRegionDto,
  UpdateBranchDto,
  UpdateCityDto,
  UpdateRegionDto,
} from './dto/geo.dto';
import { BranchesService, CitiesService, RegionsService } from './geo.services';

/**
 * Reads are open to every role including ANALYST; writes are ADMIN and above.
 * The decorators are per-method rather than per-controller precisely so the
 * two cannot be confused — a route that carries neither is denied outright by
 * the global fail-closed RolesGuard.
 */
const READ = [Role.SUPERADMIN, Role.ADMIN, Role.ANALYST] as const;
const WRITE = [Role.SUPERADMIN, Role.ADMIN] as const;

@Controller('geo/regions')
@UseInterceptors(CacheInvalidationInterceptor)
export class RegionsController {
  constructor(private readonly service: RegionsService) {}

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
  create(@Body() dto: CreateRegionDto) {
    return this.service.create(dto);
  }

  @Roles(...WRITE)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRegionDto) {
    return this.service.update(id, dto);
  }

  @Roles(...WRITE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Deleting a region that still has cities fails on the foreign key and
  // surfaces as a 409 through AllExceptionsFilter, not a 500.
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

@Controller('geo/cities')
@UseInterceptors(CacheInvalidationInterceptor)
export class CitiesController {
  constructor(private readonly service: CitiesService) {}

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
  create(@Body() dto: CreateCityDto) {
    return this.service.create(dto);
  }

  @Roles(...WRITE)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCityDto) {
    return this.service.update(id, dto);
  }

  @Roles(...WRITE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

@Controller('geo/branches')
@UseInterceptors(CacheInvalidationInterceptor)
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

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
  create(@Body() dto: CreateBranchDto) {
    return this.service.create(dto);
  }

  @Roles(...WRITE)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBranchDto) {
    return this.service.update(id, dto);
  }

  @Roles(...WRITE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
