import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { ChartsService } from './charts.service';
import { HeatmapQueryDto } from './dto/heatmap-query.dto';
import { RankingQueryDto } from './dto/ranking-query.dto';
import { TrendMetric, TrendQueryDto } from './dto/trend-query.dto';

@Controller('charts')
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.ANALYST)
@UseInterceptors(CacheInterceptor)
export class ChartsController {
  constructor(private readonly charts: ChartsService) {}

  @Get('trend')
  @CacheTTL(5 * 60 * 1000)
  getTrend(@Query() query: TrendQueryDto) {
    return this.charts.getTrend(
      query.granularity,
      query.metrics,
      query.cumulative ?? false,
    );
  }

  @Get('ranking')
  @CacheTTL(10 * 60 * 1000)
  getRanking(@Query() query: RankingQueryDto) {
    return this.charts.getRanking(
      query.dimension,
      query.metric,
      query.limit ?? 10,
      query.order ?? 'desc',
    );
  }

  @Get('heatmap')
  @CacheTTL(10 * 60 * 1000)
  getHeatmap(@Query() query: HeatmapQueryDto) {
    return this.charts.getHeatmap(
      query.type,
      query.metric ?? TrendMetric.SALES,
    );
  }

  @Get('basket-size')
  @CacheTTL(15 * 60 * 1000)
  getBasketSize() {
    return this.charts.getBasketSize();
  }

  @Get('profit-waterfall')
  @CacheTTL(15 * 60 * 1000)
  getProfitWaterfall() {
    return this.charts.getProfitWaterfall();
  }

  @Get('customer-loyalty')
  @CacheTTL(15 * 60 * 1000)
  getCustomerLoyalty() {
    return this.charts.getCustomerLoyalty();
  }

  @Get('geographic-sales')
  @CacheTTL(15 * 60 * 1000)
  getGeographicSales() {
    return this.charts.getGeographicSales();
  }
}
