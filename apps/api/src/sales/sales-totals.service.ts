import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma';

export interface SalesTotals {
  sales: Prisma.Decimal;
  cost: Prisma.Decimal;
  profit: Prisma.Decimal;
}

/**
 * "Sum the sales facts, optionally over a slice" — the one query Dashboard
 * and Charts were each spelling out.
 *
 * It returns Decimals rather than numbers because that is what the database
 * holds; money that has been through a float on the way to a caller has
 * already lost the property that made it worth storing as a Decimal.
 * Callers that need a number convert at the edge where they format.
 */
@Injectable()
export class SalesTotalsService {
  constructor(private readonly prisma: PrismaService) {}

  async sum(where?: Prisma.ReceiptItemWhereInput): Promise<SalesTotals> {
    const totals = await this.prisma.receiptItem.aggregate({
      ...(where ? { where } : {}),
      _sum: { totalPrice: true, totalCost: true, totalMargin: true },
    });

    const zero = new Prisma.Decimal(0);
    return {
      sales: totals._sum.totalPrice ?? zero,
      cost: totals._sum.totalCost ?? zero,
      profit: totals._sum.totalMargin ?? zero,
    };
  }
}
