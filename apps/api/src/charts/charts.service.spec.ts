import { Test } from '@nestjs/testing';
import { ChartsService } from './charts.service';
import { HeatmapType } from './dto/heatmap-query.dto';
import { PrismaService } from '../prisma';
import {
  SalesDimension,
  SalesGranularity,
  SalesMetric,
  SalesTotalsService,
} from '../sales';

describe('ChartsService', () => {
  let service: ChartsService;
  let prisma: {
    $queryRaw: jest.Mock;
    receiptItem: { aggregate: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      receiptItem: { aggregate: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChartsService,
        SalesTotalsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ChartsService);
  });

  describe('getTrend', () => {
    it('passes rows through unchanged when not cumulative', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { period: '2026-01-01', sales: '100' },
        { period: '2026-01-02', sales: '50' },
      ]);

      const result = await service.getTrend(
        SalesGranularity.DAY,
        [SalesMetric.SALES],
        false,
      );

      expect(result).toEqual([
        { period: '2026-01-01', sales: '100' },
        { period: '2026-01-02', sales: '50' },
      ]);
    });

    it('computes running totals per metric when cumulative', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { period: '2026-01-01', sales: 100, profit: 10 },
        { period: '2026-01-02', sales: 50, profit: 5 },
        { period: '2026-01-03', sales: 25, profit: 2 },
      ]);

      const result = await service.getTrend(
        SalesGranularity.DAY,
        [SalesMetric.SALES, SalesMetric.PROFIT],
        true,
      );

      expect(result).toEqual([
        { period: '2026-01-01', sales: 100, profit: 10 },
        { period: '2026-01-02', sales: 150, profit: 15 },
        { period: '2026-01-03', sales: 175, profit: 17 },
      ]);
    });

    it('treats a missing metric value as zero rather than NaN', async () => {
      prisma.$queryRaw.mockResolvedValue([{ period: '2026-01-01' }]);

      const result = await service.getTrend(
        SalesGranularity.DAY,
        [SalesMetric.SALES],
        true,
      );

      expect(result).toEqual([{ period: '2026-01-01', sales: 0 }]);
    });
  });

  describe('getRanking', () => {
    it('passes rows through from the query', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: 1, name: 'Kadıköy', value: '5000' },
      ]);

      const result = await service.getRanking(
        SalesDimension.BRANCH,
        SalesMetric.SALES,
        10,
        'desc',
      );

      expect(result).toEqual([{ id: 1, name: 'Kadıköy', value: '5000' }]);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('getHeatmap', () => {
    it.each([
      [HeatmapType.WEEKDAY_HOUR, 'r.receipt_time'],
      [HeatmapType.YEAR_MONTH, 'r.receipt_date'],
      [HeatmapType.REGION_CATEGORY, 'product_costs'],
    ])('routes %s to a query mentioning %s', async (type, expectedFragment) => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.getHeatmap(type, SalesMetric.SALES);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      const calls = prisma.$queryRaw.mock.calls as unknown[][];
      const query = calls[0][0] as { sql: string };
      expect(query.sql).toContain(expectedFragment);
    });

    it('passes rows through unchanged', async () => {
      prisma.$queryRaw.mockResolvedValue([{ x: 1, y: 2, value: '10' }]);

      const result = await service.getHeatmap(
        HeatmapType.WEEKDAY_HOUR,
        SalesMetric.SALES,
      );

      expect(result).toEqual([{ x: 1, y: 2, value: '10' }]);
    });
  });

  describe('getBasketSize', () => {
    it('reorders buckets small -> medium -> large -> xlarge regardless of DB order', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { bucket: 'xlarge', count: 1 },
        { bucket: 'small', count: 5 },
        { bucket: 'large', count: 2 },
        { bucket: 'medium', count: 3 },
      ]);

      const result = await service.getBasketSize();

      expect(result.map((r) => r.bucket)).toEqual([
        'small',
        'medium',
        'large',
        'xlarge',
      ]);
    });
  });

  describe('getCustomerLoyalty', () => {
    it('reorders tiers new -> occasional -> regular -> loyal', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { bucket: 'loyal', count: 1 },
        { bucket: 'new', count: 5 },
      ]);

      const result = await service.getCustomerLoyalty();

      expect(result.map((r) => r.bucket)).toEqual(['new', 'loyal']);
    });
  });

  describe('getProfitWaterfall', () => {
    it('turns aggregate totals into three signed steps', async () => {
      prisma.receiptItem.aggregate.mockResolvedValue({
        _sum: { totalPrice: 1000, totalCost: 600, totalMargin: 400 },
      });

      const result = await service.getProfitWaterfall();

      expect(result).toEqual([
        { step: 'sales', value: 1000 },
        { step: 'cost', value: -600 },
        { step: 'profit', value: 400 },
      ]);
    });

    it('defaults to zero when there is no data', async () => {
      prisma.receiptItem.aggregate.mockResolvedValue({
        _sum: { totalPrice: null, totalCost: null, totalMargin: null },
      });

      const result = await service.getProfitWaterfall();

      expect(result).toEqual([
        { step: 'sales', value: 0 },
        { step: 'cost', value: -0 },
        { step: 'profit', value: 0 },
      ]);
    });
  });

  describe('getGeographicSales', () => {
    it('passes rows through from the query', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 1,
          name: 'Kadıköy',
          latitude: 40.98,
          longitude: 29.03,
          sales: '500',
        },
      ]);

      const result = await service.getGeographicSales();

      expect(result).toEqual([
        {
          id: 1,
          name: 'Kadıköy',
          latitude: 40.98,
          longitude: 29.03,
          sales: '500',
        },
      ]);
    });
  });
});
