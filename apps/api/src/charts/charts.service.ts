import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma';
import {
  SALES_DIMENSION,
  SALES_FACT,
  SALES_METRIC_EXPR,
  SALES_PERIOD_EXPR,
  SalesDimension,
  SalesGranularity,
  SalesMetric,
  SalesTotalsService,
} from '../sales';
import type {
  BucketRow,
  GeographicSalesRow,
  HeatmapRow,
  RankingRow,
  TrendRow,
  WaterfallStep,
} from '@hakmar/contracts';
import { HeatmapType } from './dto/heatmap-query.dto';
import { RankingMetric } from './dto/ranking-query.dto';

/**
 * Response shapes are defined once, in @hakmar/contracts, and re-exported
 * here so this module still reads as the owner of its own API. If a query's
 * SELECT list stops matching the shape the web renders, that is now a
 * compile error on this side rather than an empty column on the other.
 */
export type {
  BucketRow,
  GeographicSalesRow,
  HeatmapRow,
  RankingRow,
  TrendRow,
  WaterfallStep,
} from '@hakmar/contracts';

const BASKET_SIZE_ORDER = ['small', 'medium', 'large', 'xlarge'];
const LOYALTY_TIER_ORDER = ['new', 'occasional', 'regular', 'loyal'];

@Injectable()
export class ChartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesTotals: SalesTotalsService,
  ) {}

  /**
   * Replaces ~18 near-identical legacy endpoints (sales-trend, daily-sales,
   * monthly-orders, yearly-sales-trend, cumulative-sales-trend, weekday-sales,
   * hourly-sales, sales-cost-profit-margin-combo, ...) with one parameterized
   * query. Metric/granularity selection is enum-validated before it ever
   * reaches SQL, so this is not the legacy app's "any column, any table"
   * generic engine.
   */
  async getTrend(
    granularity: SalesGranularity,
    metrics: SalesMetric[],
    cumulative: boolean,
  ): Promise<TrendRow[]> {
    const periodExpr = SALES_PERIOD_EXPR[granularity];
    const metricSelects = Prisma.join(
      metrics.map(
        (m) => Prisma.sql`${SALES_METRIC_EXPR[m]} AS ${Prisma.raw(m)}`,
      ),
      ', ',
    );

    const rows = await this.prisma.$queryRaw<TrendRow[]>(Prisma.sql`
      SELECT ${periodExpr} AS period, ${metricSelects}
      ${SALES_FACT}
      GROUP BY ${periodExpr}
      ORDER BY ${periodExpr} ASC
    `);

    return cumulative ? this.applyCumulative(rows, metrics) : rows;
  }

  /**
   * Replaces ~15 legacy endpoints (brand-distribution, top-products,
   * worst-products, branch-sales, category-sales-distribution, ...) with one
   * parameterized top/bottom-N query.
   */
  async getRanking(
    dimension: SalesDimension,
    metric: RankingMetric,
    limit: number,
    order: 'asc' | 'desc',
  ): Promise<RankingRow[]> {
    const { idExpr, nameExpr, joins } = SALES_DIMENSION[dimension];
    const metricExpr = SALES_METRIC_EXPR[metric];
    const orderSql = order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    return this.prisma.$queryRaw<RankingRow[]>(Prisma.sql`
      SELECT ${idExpr} AS id, ${nameExpr} AS name, ${metricExpr} AS value
      ${SALES_FACT}
      ${joins}
      GROUP BY ${idExpr}, ${nameExpr}
      ORDER BY value ${orderSql}
      LIMIT ${limit}
    `);
  }

  /**
   * Replaces 3 legacy heatmap endpoints (daily-hourly-sales-heatmap,
   * monthly-daily-sales-heatmap, region-product-cost-heatmap). These three
   * axis pairings are genuinely distinct — not a copy-paste family like the
   * trend/ranking endpoints were — so this stays three explicit modes
   * behind one route rather than a free-form xAxis/yAxis combinator that
   * would allow nonsensical pairings (e.g. weekday × weekday).
   */
  async getHeatmap(
    type: HeatmapType,
    metric: SalesMetric,
  ): Promise<HeatmapRow[]> {
    switch (type) {
      case HeatmapType.WEEKDAY_HOUR:
        return this.weekdayHourHeatmap(metric);
      case HeatmapType.YEAR_MONTH:
        return this.yearMonthHeatmap(metric);
      case HeatmapType.REGION_CATEGORY:
        return this.regionCategoryHeatmap();
    }
  }

  private weekdayHourHeatmap(metric: SalesMetric): Promise<HeatmapRow[]> {
    const metricExpr = SALES_METRIC_EXPR[metric];
    return this.prisma.$queryRaw<HeatmapRow[]>(Prisma.sql`
      SELECT EXTRACT(ISODOW FROM r.receipt_date)::int AS x,
             EXTRACT(HOUR FROM r.receipt_time)::int AS y,
             ${metricExpr} AS value
      ${SALES_FACT}
      GROUP BY x, y
      ORDER BY x, y
    `);
  }

  private yearMonthHeatmap(metric: SalesMetric): Promise<HeatmapRow[]> {
    const metricExpr = SALES_METRIC_EXPR[metric];
    return this.prisma.$queryRaw<HeatmapRow[]>(Prisma.sql`
      SELECT EXTRACT(YEAR FROM r.receipt_date)::int AS x,
             EXTRACT(MONTH FROM r.receipt_date)::int AS y,
             ${metricExpr} AS value
      ${SALES_FACT}
      GROUP BY x, y
      ORDER BY x, y
    `);
  }

  private regionCategoryHeatmap(): Promise<HeatmapRow[]> {
    return this.prisma.$queryRaw<HeatmapRow[]>(Prisma.sql`
      SELECT reg.name AS x,
             cat.name AS y,
             COALESCE(AVG(pc.unit_cost), 0) AS value
      FROM product_costs pc
      JOIN regions reg ON reg.id = pc.region_id
      JOIN products p ON p.id = pc.product_id
      JOIN subcategories sc ON sc.id = p.subcategory_id
      JOIN categories cat ON cat.id = sc.category_id
      GROUP BY reg.name, cat.name
      ORDER BY reg.name, cat.name
    `);
  }

  /** Replaces legacy basket-size: how many receipts fall into each basket-value tier. */
  async getBasketSize(): Promise<BucketRow[]> {
    const rows = await this.prisma.$queryRaw<BucketRow[]>(Prisma.sql`
      SELECT bucket, COUNT(*)::int AS count
      FROM (
        SELECT CASE
          WHEN basket_total < 100 THEN 'small'
          WHEN basket_total < 300 THEN 'medium'
          WHEN basket_total < 600 THEN 'large'
          ELSE 'xlarge'
        END AS bucket
        FROM (
          SELECT SUM(ri.total_price) AS basket_total
          ${SALES_FACT}
          GROUP BY r.id
        ) per_receipt
      ) bucketed
      GROUP BY bucket
    `);
    return this.sortByOrder(rows, BASKET_SIZE_ORDER);
  }

  /** Replaces legacy profit-waterfall: sales -> cost -> net profit as three steps. */
  async getProfitWaterfall(): Promise<WaterfallStep[]> {
    const totals = await this.salesTotals.sum();
    return [
      { step: 'sales', value: Number(totals.sales) },
      { step: 'cost', value: -Number(totals.cost) },
      { step: 'profit', value: Number(totals.profit) },
    ];
  }

  /** Replaces legacy customer-loyalty: customers bucketed by visit-count tier. */
  async getCustomerLoyalty(): Promise<BucketRow[]> {
    const rows = await this.prisma.$queryRaw<BucketRow[]>(Prisma.sql`
      SELECT bucket, COUNT(*)::int AS count
      FROM (
        SELECT CASE
          WHEN visits = 1 THEN 'new'
          WHEN visits BETWEEN 2 AND 4 THEN 'occasional'
          WHEN visits BETWEEN 5 AND 10 THEN 'regular'
          ELSE 'loyal'
        END AS bucket
        FROM (
          SELECT customer_id, COUNT(*) AS visits
          FROM receipts
          GROUP BY customer_id
        ) per_customer
      ) bucketed
      GROUP BY bucket
    `);
    return this.sortByOrder(rows, LOYALTY_TIER_ORDER);
  }

  /** Replaces legacy geographic-sales-map: per-branch sales for lat/lng bubble maps. */
  getGeographicSales(): Promise<GeographicSalesRow[]> {
    return this.prisma.$queryRaw<GeographicSalesRow[]>(Prisma.sql`
      SELECT br.id,
             br.branch_name AS name,
             br.latitude,
             br.longitude,
             COALESCE(SUM(ri.total_price), 0) AS sales
      FROM branches br
      LEFT JOIN receipts r ON r.branch_id = br.id
      LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
      WHERE br.latitude IS NOT NULL AND br.longitude IS NOT NULL
      GROUP BY br.id, br.branch_name, br.latitude, br.longitude
      ORDER BY sales DESC
    `);
  }

  private sortByOrder(rows: BucketRow[], order: string[]): BucketRow[] {
    return [...rows].sort(
      (a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket),
    );
  }

  private applyCumulative(
    rows: TrendRow[],
    metrics: SalesMetric[],
  ): TrendRow[] {
    const running: Record<string, number> = {};
    return rows.map((row) => {
      const out: TrendRow = { period: row.period };
      for (const m of metrics) {
        const value = Number(row[m] ?? 0);
        running[m] = (running[m] ?? 0) + value;
        out[m] = running[m];
      }
      return out;
    });
  }
}
