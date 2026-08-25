import { Module } from '@nestjs/common';
import { SalesModule } from '../sales';
import { ChartsController } from './charts.controller';
import { ChartsService } from './charts.service';

@Module({
  imports: [SalesModule],
  controllers: [ChartsController],
  providers: [ChartsService],
})
export class ChartsModule {}
