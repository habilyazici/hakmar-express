import { Test } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';
import { Period } from './dto/period.enum';

function decimal(value: number) {
  return new Prisma.Decimal(value);
}

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    receiptItem: { aggregate: jest.Mock };
    receipt: { count: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      receiptItem: { aggregate: jest.fn() },
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
    it.each([
      [Period.WEEK, 7],
      [Period.MONTH, 30],
      [Period.QUARTER, 90],
      [Period.YEAR, 365],
    ])('sizes the %s window to %i days', async (period, days) => {
      const ranges: { gte: Date; lt: Date }[] = [];
      prisma.receiptItem.aggregate.mockImplementation(
        ({
          where,
        }: {
          where: { receipt: { receiptDate: { gte: Date; lt: Date } } };
        }) => {
          ranges.push(where.receipt.receiptDate);
          return Promise.resolve({
            _sum: { totalPrice: decimal(0), totalMargin: decimal(0) },
          });
        },
      );
      prisma.receipt.count.mockResolvedValue(0);
      prisma.$queryRaw.mockResolvedValue([{ count: 0 }]);

      await service.getPerformance(period);

      expect(ranges).toHaveLength(2);
      for (const range of ranges) {
        const spanDays =
          (range.lt.getTime() - range.gte.getTime()) / 86_400_000;
        expect(spanDays).toBe(days);
      }
    });

    it('computes a positive % change when the current window beats the previous one', async () => {
      // Distinguish "current" vs "previous" window by which date range each
      // call was filtered on, not by call order — the two windows are
      // computed concurrently via Promise.all in the service.
      interface AggregateArgs {
        where: { receipt: { receiptDate: { gte: Date } } };
      }
      interface CountArgs {
        where: { receiptDate: { gte: Date } };
      }

      prisma.receiptItem.aggregate.mockImplementation(
        ({ where }: AggregateArgs) => {
          const isCurrentWindow =
            where.receipt.receiptDate.gte >
            new Date(Date.now() - 40 * 86_400_000);
          return Promise.resolve({
            _sum: {
              totalPrice: decimal(isCurrentWindow ? 200 : 100),
              totalMargin: decimal(isCurrentWindow ? 40 : 20),
            },
          });
        },
      );
      prisma.receipt.count.mockImplementation(({ where }: CountArgs) => {
        const isCurrentWindow =
          where.receiptDate.gte > new Date(Date.now() - 40 * 86_400_000);
        return Promise.resolve(isCurrentWindow ? 10 : 5);
      });
      prisma.$queryRaw.mockResolvedValue([{ count: 2 }]);

      const result = await service.getPerformance(Period.MONTH);

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
      prisma.$queryRaw.mockResolvedValue([{ count: 0 }]);

      const result = await service.getPerformance(Period.WEEK);

      expect(result.changePct.sales).toBeNull();
      expect(result.changePct.orders).toBeNull();
    });

    it('anchors window boundaries on exact UTC midnight, not the current time-of-day', async () => {
      // receiptDate is a DATE column; Postgres compares it against a
      // timestamp by casting the date to midnight. A boundary that isn't
      // itself exact midnight silently miscounts "today"'s receipts into
      // the wrong window (see the comment in dashboard.service.ts).
      const boundaries: Date[] = [];
      prisma.receiptItem.aggregate.mockImplementation(
        ({
          where,
        }: {
          where: { receipt: { receiptDate: { gte: Date; lt: Date } } };
        }) => {
          boundaries.push(
            where.receipt.receiptDate.gte,
            where.receipt.receiptDate.lt,
          );
          return Promise.resolve({
            _sum: { totalPrice: decimal(0), totalMargin: decimal(0) },
          });
        },
      );
      prisma.receipt.count.mockResolvedValue(0);
      prisma.$queryRaw.mockResolvedValue([{ count: 0 }]);

      await service.getPerformance(Period.WEEK);

      expect(boundaries.length).toBeGreaterThan(0);
      for (const boundary of boundaries) {
        expect(boundary.getUTCHours()).toBe(0);
        expect(boundary.getUTCMinutes()).toBe(0);
        expect(boundary.getUTCSeconds()).toBe(0);
        expect(boundary.getUTCMilliseconds()).toBe(0);
      }

      // The current window's upper bound must be the start of *tomorrow*
      // (covering all of today), not `now` mid-day.
      const upperBounds = boundaries.filter((_, i) => i % 2 === 1);
      const latestUpperBound = upperBounds.reduce((a, b) => (a > b ? a : b));
      const startOfTomorrow = new Date();
      startOfTomorrow.setUTCHours(0, 0, 0, 0);
      startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);
      expect(latestUpperBound.getTime()).toBe(startOfTomorrow.getTime());
    });
  });
});
