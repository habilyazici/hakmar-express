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
import {
  PaginationQueryDto,
  Roles,
  CacheInvalidationInterceptor,
} from '../common';
import {
  CreateCashierDto,
  CreateCustomerDto,
  UpdateCashierDto,
  UpdateCustomerDto,
} from './dto/people.dto';
import { CashiersService, CustomersService } from './people.services';

const READ = [Role.SUPERADMIN, Role.ADMIN, Role.ANALYST] as const;
const WRITE = [Role.SUPERADMIN, Role.ADMIN] as const;

@Controller('people/customers')
@UseInterceptors(CacheInvalidationInterceptor)
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

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
  create(@Body() dto: CreateCustomerDto) {
    return this.service.create(dto);
  }

  @Roles(...WRITE)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.service.update(id, dto);
  }

  @Roles(...WRITE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  // A customer with receipts cannot be deleted: the foreign key blocks it and
  // the client gets a 409. Purging a customer's history is a separate,
  // deliberate operation, not a side effect of tidying a list.
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

@Controller('people/cashiers')
@UseInterceptors(CacheInvalidationInterceptor)
export class CashiersController {
  constructor(private readonly service: CashiersService) {}

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
  create(@Body() dto: CreateCashierDto) {
    return this.service.create(dto);
  }

  @Roles(...WRITE)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCashierDto) {
    return this.service.update(id, dto);
  }

  @Roles(...WRITE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
