import { Test } from '@nestjs/testing';
import { KdsService } from './kds.service';
import { PrismaService } from '../prisma/prisma.service';

describe('KdsService', () => {
  let service: KdsService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [KdsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(KdsService);
  });

  describe('getAbcAnalysis', () => {
    it('classifies by cumulative revenue share at the 80% / 95% boundaries', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: 1, name: 'Top Seller', revenue: '800' },
        { id: 2, name: 'Mid Seller', revenue: '150' },
        { id: 3, name: 'Long Tail', revenue: '50' },
      ]);

      const result = await service.getAbcAnalysis(90);

      expect(result).toEqual([
        { id: 1, name: 'Top Seller', revenue: '800', class: 'A' },
        { id: 2, name: 'Mid Seller', revenue: '150', class: 'B' },
        { id: 3, name: 'Long Tail', revenue: '50', class: 'C' },
      ]);
    });

    it('classifies every row as C when there is no revenue at all (share defaults to 1)', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: 1, name: 'No Sales', revenue: '0' },
      ]);

      const result = await service.getAbcAnalysis(90);

      expect(result).toEqual([
        { id: 1, name: 'No Sales', revenue: '0', class: 'C' },
      ]);
    });

    it('interpolates the days window into the query', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.getAbcAnalysis(30);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      const calls = prisma.$queryRaw.mock.calls as unknown[][];
      const query = calls[0][0] as { values: unknown[] };
      expect(query.values).toContain(30);
    });
  });

  describe('getDemandForecast', () => {
    it('passes rows through from the query', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { productId: 1, productName: 'T Product', forecastQty: '4.5' },
      ]);

      const result = await service.getDemandForecast(50);

      expect(result).toEqual([
        { productId: 1, productName: 'T Product', forecastQty: '4.5' },
      ]);
    });

    it('interpolates the limit into the query', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.getDemandForecast(25);

      const calls = prisma.$queryRaw.mock.calls as unknown[][];
      const query = calls[0][0] as { values: unknown[] };
      expect(query.values).toContain(25);
    });
  });

  describe('getCustomerSegmentation', () => {
    it('passes rows through from the query', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 1,
          name: 'T Customer',
          recencyDays: 5,
          frequency: 10,
          monetary: '1000',
          segment: 'Champions',
        },
      ]);

      const result = await service.getCustomerSegmentation(50);

      expect(result).toEqual([
        {
          id: 1,
          name: 'T Customer',
          recencyDays: 5,
          frequency: 10,
          monetary: '1000',
          segment: 'Champions',
        },
      ]);
    });
  });

  describe('getMarketBasket', () => {
    it('passes rows through from the query', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          productId: 2,
          productName: 'Co-Purchased',
          coCount: 3,
          confidencePct: '60.0',
        },
      ]);

      const result = await service.getMarketBasket(1, 10);

      expect(result).toEqual([
        {
          productId: 2,
          productName: 'Co-Purchased',
          coCount: 3,
          confidencePct: '60.0',
        },
      ]);
    });

    it('interpolates the target productId and limit into the query', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.getMarketBasket(7, 20);

      const calls = prisma.$queryRaw.mock.calls as unknown[][];
      const query = calls[0][0] as { values: unknown[] };
      expect(query.values).toContain(7);
      expect(query.values).toContain(20);
    });
  });
});
