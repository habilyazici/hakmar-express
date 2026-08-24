import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { AbcQueryDto, TopNQueryDto } from './dto/kds-query.dto';
import { MarketBasketQueryDto } from './dto/market-basket-query.dto';
import { KdsService } from './kds.service';

@Controller('kds')
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.ANALYST)
@UseInterceptors(CacheInterceptor)
export class KdsController {
  constructor(private readonly kds: KdsService) {}

  @Get('abc-analysis')
  @CacheTTL(30 * 60 * 1000)
  getAbcAnalysis(@Query() query: AbcQueryDto) {
    return this.kds.getAbcAnalysis(query.days ?? 90);
  }

  @Get('demand-forecast')
  @CacheTTL(15 * 60 * 1000)
  getDemandForecast(@Query() query: TopNQueryDto) {
    return this.kds.getDemandForecast(query.limit ?? 50);
  }

  @Get('customer-segmentation')
  @CacheTTL(30 * 60 * 1000)
  getCustomerSegmentation(@Query() query: TopNQueryDto) {
    return this.kds.getCustomerSegmentation(query.limit ?? 50);
  }

  @Get('market-basket')
  @CacheTTL(30 * 60 * 1000)
  getMarketBasket(@Query() query: MarketBasketQueryDto) {
    return this.kds.getMarketBasket(query.productId, query.limit ?? 10);
  }
}
