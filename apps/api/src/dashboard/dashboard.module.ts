import { Module } from '@nestjs/common';
import { SalesModule } from '../sales';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [SalesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
