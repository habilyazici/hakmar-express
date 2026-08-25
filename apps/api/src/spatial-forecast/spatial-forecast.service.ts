import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma';
import { SALES_METRIC_EXPR, SalesMetric } from '../sales';
import {
  DiscountScope,
  ForecastMetric,
  ForecastRequestDto,
  MapType,
} from './dto/forecast-request.dto';
import {
  NotEnoughDataError,
  fitOls,
  predict,
  type OlsModel,
} from './regression/ols';

/**
 * Elasticity assumptions used by the simulation. These are judgement calls,
 * not values estimated from the data, so they live here named and in one
 * place instead of scattered as bare numbers through the arithmetic.
 */
export const ELASTICITY = {
  /** A 1% price cut is assumed to lift unit volume by this much. */
  price: 3.0,
  /** A 1% rise in purchasing power is assumed to lift unit volume by this much. */
  purchasingPower: 0.8,
} as const;

/** Base metrics are forecast independently; profit is derived from them. */
const BASE_METRICS = ['quantity', 'sales', 'cost'] as const;
type BaseMetric = (typeof BASE_METRICS)[number];

/** Trend + two seasonal harmonics, so 5 features; fitOls needs featureCount+2 rows. */
const MIN_OBSERVATIONS = 7;

export type ForecastMethod = 'regression' | 'mean';

export interface MetricValues {
  quantity: number;
  sales: number;
  cost: number;
  profit: number;
}

export interface AreaForecast {
  id: number;
  name: string;
  plateCode: number | null;
  regionId: number | null;
  regionName: string | null;
  forecast: MetricValues;
  baseline: MetricValues;
  changePct: Record<keyof MetricValues, number | null>;
  method: ForecastMethod;
  rSquared: number | null;
}

export interface ForecastResult {
  params: {
    mapType: MapType;
    metric: ForecastMetric;
    periodMonths: number;
    discountPct: number;
    discountScope: DiscountScope;
    discountTargetId: number | null;
    costChangePct: number;
    purchasingPowerPct: number;
  };
  model: {
    monthsOfHistory: number;
    areasModeled: number;
    areasFallback: number;
    meanRSquared: number | null;
    /** Share of revenue the discount actually applies to (1 for scope=all). */
    discountShare: number;
  };
  totals: {
    forecast: MetricValues;
    baseline: MetricValues;
    changePct: Record<keyof MetricValues, number | null>;
  };
  areas: AreaForecast[];
  generatedAt: string;
}

interface MonthlyRow {
  cityId: number;
  regionId: number;
  year: number;
  month: number;
  quantity: number;
  sales: number;
  cost: number;
}

interface AreaMeta {
  id: number;
  name: string;
  plateCode: number | null;
  regionId: number | null;
  regionName: string | null;
}

@Injectable()
export class SpatialForecastService {
  private readonly logger = new Logger(SpatialForecastService.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(dto: ForecastRequestDto): Promise<ForecastResult> {
    const mapType = dto.mapType ?? MapType.CITY;
    const metric = dto.metric ?? ForecastMetric.SALES;
    const periodMonths = dto.periodMonths ?? 6;
    const discountPct = dto.discountPct ?? 0;
    const discountScope = dto.discountScope ?? DiscountScope.ALL;
    const discountTargetId = dto.discountTargetId ?? null;
    const costChangePct = dto.costChangePct ?? 0;
    const purchasingPowerPct = dto.purchasingPowerPct ?? 0;

    const history = await this.loadMonthlyHistory();
    const areas = await this.loadAreas(mapType);
    const discountShare = await this.resolveDiscountShare(
      discountScope,
      discountTargetId,
    );

    // Group the monthly series by whichever geography we are forecasting.
    const seriesByArea = new Map<number, MonthlyRow[]>();
    for (const row of history) {
      const key = mapType === MapType.CITY ? row.cityId : row.regionId;
      const bucket = seriesByArea.get(key);
      if (bucket) bucket.push(row);
      else seriesByArea.set(key, [row]);
    }

    const monthsOfHistory = new Set(history.map((r) => `${r.year}-${r.month}`))
      .size;

    const results: AreaForecast[] = [];
    let modeled = 0;
    let fallback = 0;
    const rSquaredValues: number[] = [];

    for (const area of areas) {
      const rows = mergeByMonth(seriesByArea.get(area.id) ?? []);
      const { forecast, baseline, method, rSquared } = this.forecastArea(
        rows,
        periodMonths,
      );

      if (method === 'regression') {
        modeled++;
        if (rSquared !== null) rSquaredValues.push(rSquared);
      } else {
        fallback++;
      }

      const simulated = applySimulation(forecast, {
        discountPct,
        discountShare,
        costChangePct,
        purchasingPowerPct,
      });

      results.push({
        ...area,
        forecast: simulated,
        baseline,
        changePct: changePctOf(simulated, baseline),
        method,
        rSquared,
      });
    }

    results.sort((a, b) => b.forecast[metric] - a.forecast[metric]);

    const forecastTotals = sumMetrics(results.map((r) => r.forecast));
    const baselineTotals = sumMetrics(results.map((r) => r.baseline));

    return {
      params: {
        mapType,
        metric,
        periodMonths,
        discountPct,
        discountScope,
        discountTargetId,
        costChangePct,
        purchasingPowerPct,
      },
      model: {
        monthsOfHistory,
        areasModeled: modeled,
        areasFallback: fallback,
        meanRSquared:
          rSquaredValues.length > 0
            ? rSquaredValues.reduce((a, b) => a + b, 0) / rSquaredValues.length
            : null,
        discountShare,
      },
      totals: {
        forecast: forecastTotals,
        baseline: baselineTotals,
        changePct: changePctOf(forecastTotals, baselineTotals),
      },
      areas: results,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * One model per area per metric, over that area's own monthly series.
   *
   * The legacy implementation fitted a single global regression that took
   * city_id and region_id as *numeric* features, so it learned a slope on an
   * arbitrary primary key — city 34 was treated as thirty-four times city 1.
   * It also fed the raw month number 1-12, which puts December and January at
   * opposite ends of the range even though they are adjacent. Both are
   * replaced here: geography is handled by fitting separately per area, and
   * seasonality by two Fourier harmonics of the month.
   */
  private forecastArea(
    rows: MonthlyRow[],
    periodMonths: number,
  ): {
    forecast: MetricValues;
    baseline: MetricValues;
    method: ForecastMethod;
    rSquared: number | null;
  } {
    const baseline = baselineOver(rows, periodMonths);

    if (rows.length < MIN_OBSERVATIONS) {
      // Too short a series to fit a trend; the mean of what exists is the
      // honest answer, and the response labels it as such.
      const forecast = meanForecast(rows, periodMonths);
      return { forecast, baseline, method: 'mean', rSquared: null };
    }

    const originIndex = monthIndex(rows[0].year, rows[0].month);
    const design = rows.map((r) =>
      featureVector(monthIndex(r.year, r.month) - originIndex, r.month),
    );

    const totals: Record<BaseMetric, number> = {
      quantity: 0,
      sales: 0,
      cost: 0,
    };
    const rSquaredPerMetric: number[] = [];

    const lastIndex = monthIndex(
      rows[rows.length - 1].year,
      rows[rows.length - 1].month,
    );

    for (const metric of BASE_METRICS) {
      let model: OlsModel;
      try {
        model = fitOls(
          design,
          rows.map((r) => r[metric]),
        );
      } catch (err) {
        if (err instanceof NotEnoughDataError) {
          const forecast = meanForecast(rows, periodMonths);
          return { forecast, baseline, method: 'mean', rSquared: null };
        }
        throw err;
      }
      rSquaredPerMetric.push(model.metrics.rSquared);

      for (let h = 1; h <= periodMonths; h++) {
        const absolute = lastIndex + h;
        const month = (absolute % 12) + 1;
        const value = predict(
          model,
          featureVector(absolute - originIndex, month),
        );
        // Negative volume/revenue is not a meaningful forecast.
        totals[metric] += Math.max(0, value);
      }
    }

    return {
      forecast: withProfit(totals),
      baseline,
      method: 'regression',
      rSquared:
        rSquaredPerMetric.reduce((a, b) => a + b, 0) / rSquaredPerMetric.length,
    };
  }

  private async loadMonthlyHistory(): Promise<MonthlyRow[]> {
    const rows = await this.prisma.$queryRaw<
      {
        cityId: number;
        regionId: number;
        year: number;
        month: number;
        quantity: string;
        sales: string;
        cost: string;
      }[]
    >(Prisma.sql`
      SELECT ci.id AS "cityId",
             ci.region_id AS "regionId",
             EXTRACT(YEAR FROM r.receipt_date)::int AS year,
             EXTRACT(MONTH FROM r.receipt_date)::int AS month,
             ${SALES_METRIC_EXPR[SalesMetric.QUANTITY]} AS quantity,
             ${SALES_METRIC_EXPR[SalesMetric.SALES]} AS sales,
             ${SALES_METRIC_EXPR[SalesMetric.COST]} AS cost
      FROM receipt_items ri
      JOIN receipts r ON r.id = ri.receipt_id
      JOIN branches br ON br.id = r.branch_id
      JOIN cities ci ON ci.id = br.city_id
      WHERE r.receipt_date < CURRENT_DATE
      GROUP BY ci.id, ci.region_id, year, month
      ORDER BY ci.id, year, month
    `);

    return rows.map((r) => ({
      cityId: r.cityId,
      regionId: r.regionId,
      year: r.year,
      month: r.month,
      quantity: Number(r.quantity),
      sales: Number(r.sales),
      cost: Number(r.cost),
    }));
  }

  private async loadAreas(mapType: MapType): Promise<AreaMeta[]> {
    if (mapType === MapType.REGION) {
      const regions = await this.prisma.region.findMany({
        orderBy: { name: 'asc' },
      });
      return regions.map((r) => ({
        id: r.id,
        name: r.name,
        plateCode: null,
        regionId: r.id,
        regionName: r.name,
      }));
    }

    const cities = await this.prisma.city.findMany({
      include: { region: true },
      orderBy: { name: 'asc' },
    });
    return cities.map((c) => ({
      id: c.id,
      name: c.name,
      plateCode: c.plateCode,
      regionId: c.regionId,
      regionName: c.region.name,
    }));
  }

  /**
   * The share of revenue a scoped discount actually touches.
   *
   * The legacy version hardcoded 30% for any category and 8% for any product,
   * with a comment conceding the real figure should come from the database.
   * That made every category-scoped simulation produce the same answer no
   * matter which category was chosen. This reads the real share.
   */
  private async resolveDiscountShare(
    scope: DiscountScope,
    targetId: number | null,
  ): Promise<number> {
    if (scope === DiscountScope.ALL || targetId === null) return 1;

    const filter =
      scope === DiscountScope.CATEGORY
        ? Prisma.sql`sc.category_id = ${targetId}`
        : Prisma.sql`p.id = ${targetId}`;

    const [row] = await this.prisma.$queryRaw<{ share: string | null }[]>(
      Prisma.sql`
        SELECT CASE
                 WHEN SUM(ri.total_price) IS NULL OR SUM(ri.total_price) = 0 THEN 0
                 ELSE SUM(ri.total_price) FILTER (WHERE ${filter})
                      / SUM(ri.total_price)
               END AS share
        FROM receipt_items ri
        JOIN products p ON p.id = ri.product_id
        JOIN subcategories sc ON sc.id = p.subcategory_id
      `,
    );

    const share = Number(row?.share ?? 0);
    if (!Number.isFinite(share)) return 0;
    return Math.min(1, Math.max(0, share));
  }

  async saveRun(result: ForecastResult, createdById: number): Promise<number> {
    const run = await this.prisma.spatialForecastRun.create({
      data: {
        mapType: result.params.mapType,
        metric: result.params.metric,
        periodMonths: result.params.periodMonths,
        discountPct: result.params.discountPct,
        discountType: result.params.discountScope,
        discountTargetId: result.params.discountTargetId,
        costChangePct: result.params.costChangePct,
        purchasingPowerPct: result.params.purchasingPowerPct,
        resultJson: result as unknown as Prisma.InputJsonValue,
        createdById,
      },
      select: { id: true },
    });
    this.logger.log(
      `Saved spatial forecast run ${run.id} (${result.params.mapType}/${result.params.metric}, ${result.params.periodMonths}m).`,
    );
    return run.id;
  }

  listRuns(limit: number) {
    return this.prisma.spatialForecastRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      // resultJson is deliberately excluded: it is the entire per-area payload
      // and would make the history listing enormous.
      select: {
        id: true,
        mapType: true,
        metric: true,
        periodMonths: true,
        discountPct: true,
        discountType: true,
        discountTargetId: true,
        costChangePct: true,
        purchasingPowerPct: true,
        createdAt: true,
        createdById: true,
      },
    });
  }

  getRun(id: number) {
    return this.prisma.spatialForecastRun.findUniqueOrThrow({ where: { id } });
  }
}

/** Months since a fixed epoch, so arithmetic across year boundaries is trivial. */
function monthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

/**
 * Trend plus two Fourier harmonics of the annual cycle. The harmonics keep
 * December adjacent to January, which a raw 1-12 month number does not.
 */
function featureVector(t: number, month: number): number[] {
  const angle = (2 * Math.PI * (month - 1)) / 12;
  return [
    t,
    Math.sin(angle),
    Math.cos(angle),
    Math.sin(2 * angle),
    Math.cos(2 * angle),
  ];
}

/** Collapses duplicate (year, month) rows, e.g. several cities inside a region. */
function mergeByMonth(rows: MonthlyRow[]): MonthlyRow[] {
  const merged = new Map<number, MonthlyRow>();
  for (const row of rows) {
    const key = monthIndex(row.year, row.month);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...row });
      continue;
    }
    existing.quantity += row.quantity;
    existing.sales += row.sales;
    existing.cost += row.cost;
  }
  return [...merged.values()].sort(
    (a, b) => monthIndex(a.year, a.month) - monthIndex(b.year, b.month),
  );
}

/** The most recent `periodMonths` of actuals, i.e. what the forecast is compared against. */
function baselineOver(rows: MonthlyRow[], periodMonths: number): MetricValues {
  const recent = rows.slice(-periodMonths);
  const totals = recent.reduce<Record<BaseMetric, number>>(
    (acc, r) => {
      acc.quantity += r.quantity;
      acc.sales += r.sales;
      acc.cost += r.cost;
      return acc;
    },
    { quantity: 0, sales: 0, cost: 0 },
  );
  return withProfit(totals);
}

function meanForecast(rows: MonthlyRow[], periodMonths: number): MetricValues {
  if (rows.length === 0) {
    return { quantity: 0, sales: 0, cost: 0, profit: 0 };
  }
  const totals = rows.reduce<Record<BaseMetric, number>>(
    (acc, r) => {
      acc.quantity += r.quantity;
      acc.sales += r.sales;
      acc.cost += r.cost;
      return acc;
    },
    { quantity: 0, sales: 0, cost: 0 },
  );
  const scale = periodMonths / rows.length;
  return withProfit({
    quantity: totals.quantity * scale,
    sales: totals.sales * scale,
    cost: totals.cost * scale,
  });
}

/**
 * Profit is always derived, never forecast independently, so the four numbers
 * stay internally consistent. The legacy service forecast only the selected
 * metric and left the other three at zero, then ran the simulation over all
 * four — so with metric=sales it computed profit = sales - 0, and reported
 * profit exactly equal to revenue whenever any simulation parameter was set.
 */
function withProfit(totals: Record<BaseMetric, number>): MetricValues {
  return { ...totals, profit: totals.sales - totals.cost };
}

interface SimulationParams {
  discountPct: number;
  discountShare: number;
  costChangePct: number;
  purchasingPowerPct: number;
}

export function applySimulation(
  base: MetricValues,
  params: SimulationParams,
): MetricValues {
  let { quantity, sales, cost } = base;

  if (params.discountPct > 0 && params.discountShare > 0) {
    // Only the discounted share of the basket responds; the rest is untouched.
    const effectiveDiscount = params.discountPct * params.discountShare;
    const volumeLift = (effectiveDiscount * ELASTICITY.price) / 100;

    quantity *= 1 + volumeLift;
    // Revenue moves two ways: the discount cuts the price on the affected
    // share, and the extra volume adds revenue back.
    const discountLoss =
      sales * params.discountShare * (params.discountPct / 100);
    sales = sales - discountLoss + sales * volumeLift;
    // Unit cost is unchanged, so cost scales with volume only.
    cost *= 1 + volumeLift;
  }

  if (params.costChangePct !== 0) {
    cost *= 1 + params.costChangePct / 100;
  }

  if (params.purchasingPowerPct !== 0) {
    const volumeLift =
      (params.purchasingPowerPct * ELASTICITY.purchasingPower) / 100;
    quantity *= 1 + volumeLift;
    sales *= 1 + volumeLift;
    cost *= 1 + volumeLift;
  }

  return {
    quantity: Math.max(0, quantity),
    sales: Math.max(0, sales),
    cost: Math.max(0, cost),
    // Profit stays derived and is allowed to go negative — that is a real,
    // actionable outcome of a heavy discount or a cost shock.
    profit: Math.max(0, sales) - Math.max(0, cost),
  };
}

function sumMetrics(values: MetricValues[]): MetricValues {
  return values.reduce<MetricValues>(
    (acc, v) => ({
      quantity: acc.quantity + v.quantity,
      sales: acc.sales + v.sales,
      cost: acc.cost + v.cost,
      profit: acc.profit + v.profit,
    }),
    { quantity: 0, sales: 0, cost: 0, profit: 0 },
  );
}

/**
 * Null rather than a sentinel when there is no baseline to compare against.
 * The legacy code substituted 0.01 for a zero baseline and then capped the
 * result at 1000%, so a city with no history reported "+1000%" as if it were
 * a measured change.
 */
function changePctOf(
  forecast: MetricValues,
  baseline: MetricValues,
): Record<keyof MetricValues, number | null> {
  const keys: (keyof MetricValues)[] = ['quantity', 'sales', 'cost', 'profit'];
  const out = {} as Record<keyof MetricValues, number | null>;
  for (const key of keys) {
    const base = baseline[key];
    out[key] =
      base === 0 ? null : ((forecast[key] - base) / Math.abs(base)) * 100;
  }
  return out;
}
