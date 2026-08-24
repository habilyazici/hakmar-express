import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

const PERIOD_DAYS: Record<string, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

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
    const [
      branches,
      customers,
      products,
      brands,
      receipts,
      cashiers,
      totals,
    ] = await Promise.all([
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

  async getPerformance(period: string) {
    const days = PERIOD_DAYS[period];
    if (!days) {
      throw new NotFoundException(
        `Unknown period "${period}". Expected one of: ${Object.keys(PERIOD_DAYS).join(', ')}.`,
      );
    }

    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 86_400_000);
    const previousStart = new Date(now.getTime() - 2 * days * 86_400_000);

    const [current, previous] = await Promise.all([
      this.windowStats(currentStart, now),
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
    const [itemTotals, orders, productGroups] = await Promise.all([
      this.prisma.receiptItem.aggregate({
        where: { receipt: { receiptDate: { gte: start, lt: end } } },
        _sum: { totalPrice: true, totalMargin: true },
      }),
      this.prisma.receipt.count({
        where: { receiptDate: { gte: start, lt: end } },
      }),
      this.prisma.receiptItem.groupBy({
        by: ['productId'],
        where: { receipt: { receiptDate: { gte: start, lt: end } } },
      }),
    ]);

    const sales = toNumber(itemTotals._sum.totalPrice);
    const profit = toNumber(itemTotals._sum.totalMargin);

    return {
      sales,
      profit,
      orders,
      avgBasket: orders > 0 ? sales / orders : 0,
      distinctProducts: productGroups.length,
    };
  }
}

function toNumber(value: Prisma.Decimal | null): number {
  return value ? Number(value) : 0;
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
