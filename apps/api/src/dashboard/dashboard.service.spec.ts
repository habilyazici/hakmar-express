import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

function decimal(value: number) {
  return new Prisma.Decimal(value);
}

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    receiptItem: {
      aggregate: jest.Mock;
      groupBy: jest.Mock;
    };
    receipt: { count: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      receiptItem: { aggregate: jest.fn(), groupBy: jest.fn() },
      receipt: { count: jest.fn() },
      $queryRaw: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  describe('getSummary', () => {
    it('returns zero totals when there are no receipt items', async () => {
      prisma.receiptItem.aggregate.mockResolvedValue({
        _sum: { totalPrice: null, totalMargin: null },
      });

      const result = await service.getSummary();

      expect(result.totalSales.toString()).toBe('0');
      expect(result.totalProfit.toString()).toBe('0');
    });

    it('passes through the summed totals', async () => {
      prisma.receiptItem.aggregate.mockResolvedValue({
        _sum: { totalPrice: decimal(1500), totalMargin: decimal(300) },
      });

      const result = await service.getSummary();

      expect(result.totalSales.toString()).toBe('1500');
      expect(result.totalProfit.toString()).toBe('300');
    });
  });

  describe('getPerformance', () => {
    it('rejects an unknown period without hitting the database', async () => {
      await expect(service.getPerformance('fortnight')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.receiptItem.aggregate).not.toHaveBeenCalled();
    });

    it('computes a positive % change when the current window beats the previous one', async () => {
      // Distinguish "current" vs "previous" window by which date range each
      // call was filtered on, not by call order — the two windows are
      // computed concurrently via Promise.all in the service.
      prisma.receiptItem.aggregate.mockImplementation(({ where }) => {
        const isCurrentWindow =
          where.receipt.receiptDate.gte >
          new Date(Date.now() - 40 * 86_400_000);
        return Promise.resolve({
          _sum: {
            totalPrice: decimal(isCurrentWindow ? 200 : 100),
            totalMargin: decimal(isCurrentWindow ? 40 : 20),
          },
        });
      });
      prisma.receipt.count.mockImplementation(({ where }) => {
        const isCurrentWindow =
          where.receiptDate.gte > new Date(Date.now() - 40 * 86_400_000);
        return Promise.resolve(isCurrentWindow ? 10 : 5);
      });
      prisma.receiptItem.groupBy.mockResolvedValue([
        { productId: 1 },
        { productId: 2 },
      ]);

      const result = await service.getPerformance('month');

      expect(result.current.sales).toBe(200);
      expect(result.previous.sales).toBe(100);
      expect(result.changePct.sales).toBe(100);
      expect(result.changePct.orders).toBe(100);
    });

    it('returns null % change instead of dividing by zero when the previous window had none', async () => {
      // Both windows report zero sales, so previous === 0 for every metric
      // and percentChange must short-circuit to null rather than NaN/Infinity.
      prisma.receiptItem.aggregate.mockResolvedValue({
        _sum: { totalPrice: decimal(0), totalMargin: decimal(0) },
      });
      prisma.receipt.count.mockResolvedValue(0);
      prisma.receiptItem.groupBy.mockResolvedValue([]);

      const result = await service.getPerformance('week');

      expect(result.changePct.sales).toBeNull();
      expect(result.changePct.orders).toBeNull();
    });
  });
});
