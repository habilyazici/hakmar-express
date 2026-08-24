import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import {
  DiscountScope,
  ForecastMetric,
  MapType,
} from './dto/forecast-request.dto';
import {
  ELASTICITY,
  SpatialForecastService,
  applySimulation,
  type MetricValues,
} from './spatial-forecast.service';

const BASE: MetricValues = {
  quantity: 100,
  sales: 1000,
  cost: 600,
  profit: 400,
};

const NEUTRAL = {
  discountPct: 0,
  discountShare: 1,
  costChangePct: 0,
  purchasingPowerPct: 0,
};

describe('applySimulation', () => {
  it('leaves the forecast untouched when no parameter is set', () => {
    expect(applySimulation(BASE, NEUTRAL)).toEqual(BASE);
  });

  it('lifts volume by the price elasticity and nets the discount off revenue', () => {
    // 10% off everything -> volume +10 * 3.0 = +30%
    const result = applySimulation(BASE, { ...NEUTRAL, discountPct: 10 });

    const lift = (10 * ELASTICITY.price) / 100; // 0.30
    expect(result.quantity).toBeCloseTo(100 * 1.3, 9);
    // 1000 - (1000 * 1 * 0.10) + (1000 * 0.30) = 1200
    expect(result.sales).toBeCloseTo(1000 - 100 + 1000 * lift, 9);
    expect(result.cost).toBeCloseTo(600 * 1.3, 9);
    expect(result.profit).toBeCloseTo(result.sales - result.cost, 9);
  });

  /**
   * The legacy service hardcoded a 30% share for any category and 8% for any
   * product, so every category-scoped run produced an identical answer no
   * matter which category was picked. The share is now a real input.
   */
  it('scales the discount effect by the share it actually applies to', () => {
    const full = applySimulation(BASE, { ...NEUTRAL, discountPct: 10 });
    const half = applySimulation(BASE, {
      ...NEUTRAL,
      discountPct: 10,
      discountShare: 0.5,
    });

    // Half the basket discounted -> half the volume response.
    expect(half.quantity - BASE.quantity).toBeCloseTo(
      (full.quantity - BASE.quantity) / 2,
      9,
    );
    expect(half.quantity).toBeGreaterThan(BASE.quantity);
    expect(half.quantity).toBeLessThan(full.quantity);
  });

  it('does nothing when the discounted share is zero', () => {
    const result = applySimulation(BASE, {
      ...NEUTRAL,
      discountPct: 25,
      discountShare: 0,
    });
    expect(result).toEqual(BASE);
  });

  it('applies a cost shock to cost only, and lets profit fall out of it', () => {
    const result = applySimulation(BASE, { ...NEUTRAL, costChangePct: 50 });

    expect(result.sales).toBeCloseTo(1000, 9);
    expect(result.quantity).toBeCloseTo(100, 9);
    expect(result.cost).toBeCloseTo(900, 9);
    expect(result.profit).toBeCloseTo(100, 9);
  });

  it('lets profit go negative when a cost shock exceeds the margin', () => {
    const result = applySimulation(BASE, { ...NEUTRAL, costChangePct: 100 });

    expect(result.cost).toBeCloseTo(1200, 9);
    expect(result.profit).toBeCloseTo(-200, 9);
  });

  it('moves volume and revenue together for a purchasing-power change', () => {
    const result = applySimulation(BASE, {
      ...NEUTRAL,
      purchasingPowerPct: 10,
    });

    const lift = (10 * ELASTICITY.purchasingPower) / 100; // 0.08
    expect(result.quantity).toBeCloseTo(100 * (1 + lift), 9);
    expect(result.sales).toBeCloseTo(1000 * (1 + lift), 9);
    expect(result.cost).toBeCloseTo(600 * (1 + lift), 9);
  });

  it('shrinks the whole basket when purchasing power falls', () => {
    const result = applySimulation(BASE, {
      ...NEUTRAL,
      purchasingPowerPct: -25,
    });

    expect(result.quantity).toBeLessThan(BASE.quantity);
    expect(result.sales).toBeLessThan(BASE.sales);
    expect(result.profit).toBeLessThan(BASE.profit);
  });

  /**
   * The legacy predict() filled only the selected metric and left the other
   * three at zero, then ran this arithmetic over all four. With metric=sales
   * that made cost 0 and reported profit === sales for every simulated run.
   */
  it('keeps profit equal to sales minus cost, never equal to sales', () => {
    for (const params of [
      { ...NEUTRAL, discountPct: 15 },
      { ...NEUTRAL, costChangePct: -20 },
      { ...NEUTRAL, purchasingPowerPct: 30 },
      { ...NEUTRAL, discountPct: 5, costChangePct: 10, purchasingPowerPct: 5 },
    ]) {
      const result = applySimulation(BASE, params);
      expect(result.profit).toBeCloseTo(result.sales - result.cost, 9);
      expect(result.profit).not.toBeCloseTo(result.sales, 6);
    }
  });

  it('never reports negative volume or revenue', () => {
    const result = applySimulation(BASE, {
      ...NEUTRAL,
      purchasingPowerPct: -90,
    });

    expect(result.quantity).toBeGreaterThanOrEqual(0);
    expect(result.sales).toBeGreaterThanOrEqual(0);
    expect(result.cost).toBeGreaterThanOrEqual(0);
  });
});

describe('SpatialForecastService', () => {
  let service: SpatialForecastService;
  let prisma: {
    $queryRaw: jest.Mock;
    city: { findMany: jest.Mock };
    region: { findMany: jest.Mock };
    spatialForecastRun: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
  };

  /** 24 months of a clean upward trend for one city, starting Jan 2024. */
  function monthlyHistory(cityId = 1, months = 24) {
    return Array.from({ length: months }, (_, i) => ({
      cityId,
      regionId: 10,
      year: 2024 + Math.floor(i / 12),
      month: (i % 12) + 1,
      quantity: String(10 + i),
      sales: String(1000 + i * 100),
      cost: String(600 + i * 60),
    }));
  }

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      city: { findMany: jest.fn().mockResolvedValue([]) },
      region: { findMany: jest.fn().mockResolvedValue([]) },
      spatialForecastRun: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SpatialForecastService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(SpatialForecastService);
  });

  it('fits a regression per city and projects the trend forward', async () => {
    prisma.$queryRaw.mockResolvedValue(monthlyHistory());
    prisma.city.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Test City',
        plateCode: 34,
        regionId: 10,
        region: { name: 'Test Region' },
      },
    ]);

    const result = await service.run({ periodMonths: 6 });

    expect(result.areas).toHaveLength(1);
    const area = result.areas[0];
    expect(area.method).toBe('regression');
    expect(area.rSquared).toBeGreaterThan(0.9);
    // The series rises steadily, so six months ahead must beat the last six.
    expect(area.forecast.sales).toBeGreaterThan(area.baseline.sales);
    expect(area.changePct.sales).toBeGreaterThan(0);
    expect(result.model.areasModeled).toBe(1);
    expect(result.model.areasFallback).toBe(0);
  });

  it('keeps profit derived from sales and cost in a real run', async () => {
    prisma.$queryRaw.mockResolvedValue(monthlyHistory());
    prisma.city.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Test City',
        plateCode: 34,
        regionId: 10,
        region: { name: 'Test Region' },
      },
    ]);

    const result = await service.run({ metric: ForecastMetric.SALES });
    const area = result.areas[0];

    expect(area.forecast.profit).toBeCloseTo(
      area.forecast.sales - area.forecast.cost,
      6,
    );
    expect(area.baseline.profit).toBeCloseTo(
      area.baseline.sales - area.baseline.cost,
      6,
    );
  });

  it('falls back to the mean, and says so, when a city has too little history', async () => {
    prisma.$queryRaw.mockResolvedValue(monthlyHistory(1, 3));
    prisma.city.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Sparse City',
        plateCode: 6,
        regionId: 10,
        region: { name: 'Test Region' },
      },
    ]);

    const result = await service.run({ periodMonths: 6 });

    expect(result.areas[0].method).toBe('mean');
    expect(result.areas[0].rSquared).toBeNull();
    expect(result.model.areasFallback).toBe(1);
    expect(result.model.areasModeled).toBe(0);
    expect(result.areas[0].forecast.sales).toBeGreaterThan(0);
  });

  it('returns zeroed forecasts for a city with no sales at all', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.city.findMany.mockResolvedValue([
      {
        id: 2,
        name: 'Empty City',
        plateCode: 1,
        regionId: 10,
        region: { name: 'Test Region' },
      },
    ]);

    const result = await service.run({});
    const area = result.areas[0];

    expect(area.forecast).toEqual({
      quantity: 0,
      sales: 0,
      cost: 0,
      profit: 0,
    });
    // Null, not a fabricated percentage, when there is no baseline to compare.
    expect(area.changePct.sales).toBeNull();
  });

  it('aggregates cities into regions when mapType is region', async () => {
    prisma.$queryRaw.mockResolvedValue([
      ...monthlyHistory(1),
      ...monthlyHistory(2),
    ]);
    prisma.region.findMany.mockResolvedValue([{ id: 10, name: 'Test Region' }]);

    const result = await service.run({ mapType: MapType.REGION });

    expect(result.areas).toHaveLength(1);
    expect(result.areas[0].name).toBe('Test Region');
    expect(prisma.city.findMany).not.toHaveBeenCalled();
    // Two identical city series merged into one region series.
    expect(result.areas[0].baseline.sales).toBeGreaterThan(0);
  });

  it('reads the real revenue share for a category-scoped discount', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce(monthlyHistory())
      .mockResolvedValueOnce([{ share: '0.42' }]);
    prisma.city.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Test City',
        plateCode: 34,
        regionId: 10,
        region: { name: 'Test Region' },
      },
    ]);

    const result = await service.run({
      discountPct: 10,
      discountScope: DiscountScope.CATEGORY,
      discountTargetId: 5,
    });

    expect(result.model.discountShare).toBeCloseTo(0.42, 9);
  });

  it('treats an unscoped discount as applying to the whole basket', async () => {
    prisma.$queryRaw.mockResolvedValue(monthlyHistory());
    prisma.city.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Test City',
        plateCode: 34,
        regionId: 10,
        region: { name: 'Test Region' },
      },
    ]);

    const result = await service.run({ discountPct: 10 });

    expect(result.model.discountShare).toBe(1);
    // Only the history query runs; no share lookup is needed.
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('persists a run without the per-area payload in the listing', async () => {
    prisma.$queryRaw.mockResolvedValue(monthlyHistory());
    prisma.city.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Test City',
        plateCode: 34,
        regionId: 10,
        region: { name: 'Test Region' },
      },
    ]);

    const result = await service.run({ periodMonths: 3 });
    const runId = await service.saveRun(result, 7);

    expect(runId).toBe(1);
    const calls = prisma.spatialForecastRun.create.mock.calls as {
      data: { periodMonths: number; createdById: number };
    }[][];
    expect(calls[0][0].data.periodMonths).toBe(3);
    expect(calls[0][0].data.createdById).toBe(7);

    await service.listRuns(10);
    const listCalls = prisma.spatialForecastRun.findMany.mock.calls as {
      select: Record<string, boolean>;
    }[][];
    expect(listCalls[0][0].select.resultJson).toBeUndefined();
  });
});
