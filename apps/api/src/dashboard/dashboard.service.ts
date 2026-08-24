import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { PERIOD_DAYS, Period } from './dto/period.enum';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const totals = await this.prisma.receiptItem.aggregate({
      _sum: { totalPrice: true, totalMargin: true },
    });
    return {
      totalSales: totals._sum.totalPrice ?? new Prisma.Decimal(0),
      totalProfit: totals._sum.totalMargin ?? new Prisma.Decimal(0),
    };
  }

  async getGeneralStats() {
    const [branches, customers, products, brands, receipts, cashiers, totals] =
      await Promise.all([
        this.prisma.branch.count(),
        this.prisma.customer.count(),
        this.prisma.product.count(),
        this.prisma.brand.count(),
        this.prisma.receipt.count(),
        this.prisma.cashier.count(),
        this.prisma.receiptItem.aggregate({
          _sum: { totalPrice: true, totalMargin: true },
        }),
      ]);

    return {
      branches,
      customers,
      products,
      brands,
      receipts,
      cashiers,
      totalSales: totals._sum.totalPrice ?? new Prisma.Decimal(0),
      totalProfit: totals._sum.totalMargin ?? new Prisma.Decimal(0),
    };
  }

  // Validity of `period` is enforced by ParseEnumPipe at the controller
  // boundary (a 400, like every other bad parameter in this API), rather
  // than by a string lookup here that raised a 404 for what is a malformed
  // request, not a missing resource.
  async getPerformance(period: Period) {
    const days = PERIOD_DAYS[period];

    // receiptDate is a DATE column (no time-of-day); Postgres compares it
    // against a timestamp by casting the date up to midnight. Anchoring on
    // the current wall-clock time (rather than the start of tomorrow) left
    // boundary values with a non-midnight time-of-day, so a receipt dated
    // "today" failed `>= currentStart` (00:00 < now's time) and leaked into
    // the "previous" bucket's `< currentStart` upper bound instead.
    const tomorrow = new Date();
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const currentStart = new Date(tomorrow.getTime() - days * 86_400_000);
    const previousStart = new Date(tomorrow.getTime() - 2 * days * 86_400_000);

    const [current, previous] = await Promise.all([
      this.windowStats(currentStart, tomorrow),
      this.windowStats(previousStart, currentStart),
    ]);

    return {
      period,
      current,
      previous,
      changePct: {
        sales: percentChange(current.sales, previous.sales),
        profit: percentChange(current.profit, previous.profit),
        orders: percentChange(current.orders, previous.orders),
        avgBasket: percentChange(current.avgBasket, previous.avgBasket),
        distinctProducts: percentChange(
          current.distinctProducts,
          previous.distinctProducts,
        ),
      },
    };
  }

  async getDailySummary() {
    return this.prisma.$queryRaw<
      { day: Date; sales: Prisma.Decimal; profit: Prisma.Decimal }[]
    >(Prisma.sql`
      SELECT r.receipt_date AS day,
             COALESCE(SUM(ri.total_price), 0) AS sales,
             COALESCE(SUM(ri.total_margin), 0) AS profit
      FROM receipts r
      JOIN receipt_items ri ON ri.receipt_id = r.id
      WHERE r.receipt_date >= (CURRENT_DATE - INTERVAL '30 days')
      GROUP BY r.receipt_date
      ORDER BY r.receipt_date ASC
    `);
  }

  async getMonthlySales() {
    return this.prisma.$queryRaw<
      { month: Date; sales: Prisma.Decimal; profit: Prisma.Decimal }[]
    >(Prisma.sql`
      SELECT date_trunc('month', r.receipt_date) AS month,
             COALESCE(SUM(ri.total_price), 0) AS sales,
             COALESCE(SUM(ri.total_margin), 0) AS profit
      FROM receipts r
      JOIN receipt_items ri ON ri.receipt_id = r.id
      GROUP BY date_trunc('month', r.receipt_date)
      ORDER BY month ASC
    `);
  }

  private async windowStats(start: Date, end: Date) {
    const [itemTotals, orders, distinctProducts] = await Promise.all([
      this.prisma.receiptItem.aggregate({
        where: { receipt: { receiptDate: { gte: start, lt: end } } },
        _sum: { totalPrice: true, totalMargin: true },
      }),
      this.prisma.receipt.count({
        where: { receiptDate: { gte: start, lt: end } },
      }),
      // groupBy(['productId']).length pulled one row per distinct product
      // across the wire purely to read its array length; with a full catalog
      // in the window that is thousands of rows discarded immediately.
      // COUNT(DISTINCT ...) does it in the database and returns one number.
      this.countDistinctProducts(start, end),
    ]);

    const sales = toNumber(itemTotals._sum.totalPrice);
    const profit = toNumber(itemTotals._sum.totalMargin);

    return {
      sales,
      profit,
      orders,
      avgBasket: orders > 0 ? sales / orders : 0,
      distinctProducts,
    };
  }

  private async countDistinctProducts(start: Date, end: Date): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT ri.product_id)::int AS count
      FROM receipt_items ri
      JOIN receipts r ON r.id = ri.receipt_id
      WHERE r.receipt_date >= ${start} AND r.receipt_date < ${end}
    `);
    return row?.count ?? 0;
  }
}

function toNumber(value: Prisma.Decimal | null): number {
  return value ? Number(value) : 0;
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
