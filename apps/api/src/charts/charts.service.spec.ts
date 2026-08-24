import { Test } from '@nestjs/testing';
import { ChartsService } from './charts.service';
import { RankingDimension, RankingMetric } from './dto/ranking-query.dto';
import { TrendGranularity, TrendMetric } from './dto/trend-query.dto';
import { PrismaService } from '../prisma/prisma.service';

describe('ChartsService', () => {
  let service: ChartsService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [ChartsService, { provide: PrismaService, useValue: prisma }],
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
        TrendGranularity.DAY,
        [TrendMetric.SALES],
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
        TrendGranularity.DAY,
        [TrendMetric.SALES, TrendMetric.PROFIT],
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
        TrendGranularity.DAY,
        [TrendMetric.SALES],
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
        RankingDimension.BRANCH,
        RankingMetric.SALES,
        10,
        'desc',
      );

      expect(result).toEqual([{ id: 1, name: 'Kadıköy', value: '5000' }]);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });
});
