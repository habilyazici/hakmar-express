import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import { Roles } from '../common';
import { DashboardService } from './dashboard.service';
import { Period } from './dto/period.enum';

@Controller('dashboard')
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.ANALYST)
@UseInterceptors(CacheInterceptor)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @CacheTTL(5 * 60 * 1000)
  getSummary() {
    return this.dashboard.getSummary();
  }

  @Get('general-stats')
  @CacheTTL(30 * 60 * 1000)
  getGeneralStats() {
    return this.dashboard.getGeneralStats();
  }

  @Get('performance/:period')
  @CacheTTL(5 * 60 * 1000)
  getPerformance(@Param('period', new ParseEnumPipe(Period)) period: Period) {
    return this.dashboard.getPerformance(period);
  }

  @Get('daily-summary')
  @CacheTTL(15 * 60 * 1000)
  getDailySummary() {
    return this.dashboard.getDailySummary();
  }

  @Get('monthly-sales')
  @CacheTTL(60 * 60 * 1000)
  getMonthlySales() {
    return this.dashboard.getMonthlySales();
  }
}
