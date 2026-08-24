import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { ReceiptQueryDto } from './dto/receipt-query.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@Roles(Role.SUPERADMIN, Role.ADMIN, Role.ANALYST)
@UseInterceptors(CacheInterceptor)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  /**
   * Short TTL compared with the analytics routes: this is a transaction log,
   * and someone checking whether a receipt landed should not be looking at a
   * ten-minute-old answer.
   */
  @Get('receipts')
  @CacheTTL(30 * 1000)
  listReceipts(@Query() query: ReceiptQueryDto) {
    return this.transactions.listReceipts(query);
  }

  @Get('receipts/:id')
  @CacheTTL(30 * 1000)
  getReceipt(@Param('id', ParseIntPipe) id: number) {
    return this.transactions.getReceipt(id);
  }
}
