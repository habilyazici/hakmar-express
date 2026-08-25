import { Module } from '@nestjs/common';
import { SalesTotalsService } from './sales-totals.service';

/**
 * Sales owns the receipt tables' read model. It has no controllers: nothing
 * is exposed over HTTP as "sales" — the analytics modules are the ones with
 * routes, and they consume this.
 */
@Module({
  providers: [SalesTotalsService],
  exports: [SalesTotalsService],
})
export class SalesModule {}
