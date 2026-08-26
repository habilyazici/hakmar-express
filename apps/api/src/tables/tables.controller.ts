import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { LimitQueryDto, Role, Roles } from '../common';
import { TableRankingQueryDto } from './dto/table-ranking-query.dto';
import { TablesService } from './tables.service';

@Controller('tables')
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.ANALYST)
@UseInterceptors(CacheInterceptor)
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @Get('ranking')
  @CacheTTL(10 * 60 * 1000)
  getRanking(@Query() query: TableRankingQueryDto) {
    return this.tables.getRanking(query.entity, query.limit ?? 20);
  }

  @Get('price-cost-history')
  @CacheTTL(15 * 60 * 1000)
  getPriceCostHistory(@Query() query: LimitQueryDto) {
    return this.tables.getPriceCostHistory(query.limit ?? 50);
  }

  @Get('region-cost')
  @CacheTTL(15 * 60 * 1000)
  getRegionCost(@Query() query: LimitQueryDto) {
    return this.tables.getRegionCost(query.limit ?? 50);
  }
}
