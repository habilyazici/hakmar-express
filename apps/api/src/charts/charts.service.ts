import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HeatmapType } from './dto/heatmap-query.dto';
import { RankingDimension, RankingMetric } from './dto/ranking-query.dto';
import { TrendGranularity, TrendMetric } from './dto/trend-query.dto';

// Only these five whitelisted expressions can ever appear in a query's
// SELECT list — dto.metrics is validated against the TrendMetric enum
// before it ever reaches here (see trend-query.dto.ts), so there is no
// path from unvalidated user input to raw SQL text, unlike the legacy
// app's generic CRUD engine.
const TREND_METRIC_EXPR: Record<TrendMetric, Prisma.Sql> = {
  [TrendMetric.SALES]: Prisma.sql`COALESCE(SUM(ri.total_price), 0)`,
  [TrendMetric.COST]: Prisma.sql`COALESCE(SUM(ri.total_cost), 0)`,
  [TrendMetric.PROFIT]: Prisma.sql`COALESCE(SUM(ri.total_margin), 0)`,
  [TrendMetric.QUANTITY]: Prisma.sql`COALESCE(SUM(ri.quantity), 0)`,
  // Postgres COUNT() returns BIGINT, which node-pg/Prisma surface as a JS
  // BigInt — JSON.stringify (and therefore both the HTTP response and the
  // Redis cache serializer) cannot serialize that. Casting to ::int avoids
  // it; receipt counts will never approach the int4 ceiling.
  [TrendMetric.ORDERS]: Prisma.sql`COUNT(DISTINCT r.id)::int`,
};

const TREND_GRANULARITY_EXPR: Record<TrendGranularity, Prisma.Sql> = {
  [TrendGranularity.DAY]: Prisma.sql`r.receipt_date`,
  [TrendGranularity.WEEK]: Prisma.sql`date_trunc('week', r.receipt_date)`,
  [TrendGranularity.MONTH]: Prisma.sql`date_trunc('month', r.receipt_date)`,
  [TrendGranularity.QUARTER]: Prisma.sql`date_trunc('quarter', r.receipt_date)`,
  [TrendGranularity.YEAR]: Prisma.sql`date_trunc('year', r.receipt_date)`,
  [TrendGranularity.WEEKDAY]: Prisma.sql`EXTRACT(ISODOW FROM r.receipt_date)`,
  [TrendGranularity.HOUR]: Prisma.sql`EXTRACT(HOUR FROM r.receipt_time)`,
};

interface DimensionConfig {
  idExpr: Prisma.Sql;
  nameExpr: Prisma.Sql;
  joins: Prisma.Sql;
}

// Same whitelisting principle as above: dto.dimension is a validated
// RankingDimension enum value, so this lookup is the only thing that ever
// decides which JOINs run — user input selects a key, never SQL text.
const RANKING_DIMENSION_CONFIG: Record<RankingDimension, DimensionConfig> = {
  [RankingDimension.BRAND]: {
    idExpr: Prisma.sql`b.brand_code`,
    nameExpr: Prisma.sql`b.brand_name`,
    joins: Prisma.sql`JOIN products p ON p.id = ri.product_id JOIN brands b ON b.brand_code = p.brand_code`,
  },
  [RankingDimension.CITY]: {
    idExpr: Prisma.sql`ci.id`,
    nameExpr: Prisma.sql`ci.name`,
    joins: Prisma.sql`JOIN branches br ON br.id = r.branch_id JOIN cities ci ON ci.id = br.city_id`,
  },
  [RankingDimension.BRANCH]: {
    idExpr: Prisma.sql`br.id`,
    nameExpr: Prisma.sql`br.branch_name`,
    joins: Prisma.sql`JOIN branches br ON br.id = r.branch_id`,
  },
  [RankingDimension.REGION]: {
    idExpr: Prisma.sql`reg.id`,
    nameExpr: Prisma.sql`reg.name`,
    joins: Prisma.sql`JOIN branches br ON br.id = r.branch_id JOIN cities ci ON ci.id = br.city_id JOIN regions reg ON reg.id = ci.region_id`,
  },
  [RankingDimension.CATEGORY]: {
    idExpr: Prisma.sql`cat.id`,
    nameExpr: Prisma.sql`cat.name`,
    joins: Prisma.sql`JOIN products p ON p.id = ri.product_id JOIN subcategories sc ON sc.id = p.subcategory_id JOIN categories cat ON cat.id = sc.category_id`,
  },
  [RankingDimension.CASHIER]: {
    idExpr: Prisma.sql`ca.id`,
    nameExpr: Prisma.sql`ca.first_name || ' ' || ca.last_name`,
    joins: Prisma.sql`JOIN cashiers ca ON ca.id = r.cashier_id`,
  },
  [RankingDimension.PRODUCT]: {
    idExpr: Prisma.sql`p.id`,
    nameExpr: Prisma.sql`p.product_name`,
    joins: Prisma.sql`JOIN products p ON p.id = ri.product_id`,
  },
};

const RANKING_METRIC_EXPR: Record<RankingMetric, Prisma.Sql> = {
  [RankingMetric.SALES]: Prisma.sql`COALESCE(SUM(ri.total_price), 0)`,
  [RankingMetric.QUANTITY]: Prisma.sql`COALESCE(SUM(ri.quantity), 0)`,
  [RankingMetric.PROFIT]: Prisma.sql`COALESCE(SUM(ri.total_margin), 0)`,
};

export interface TrendRow {
  period: unknown;
  [metric: string]: unknown;
}

export interface RankingRow {
  id: string | number;
  name: string;
  value: string;
}

export interface HeatmapRow {
  x: string | number;
  y: string | number;
  value: string | number;
}

export interface BucketRow {
  bucket: string;
  count: number;
}

export interface WaterfallStep {
  step: 'sales' | 'cost' | 'profit';
  value: number;
}

export interface GeographicSalesRow {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  sales: string;
}

const BASKET_SIZE_ORDER = ['small', 'medium', 'large', 'xlarge'];
const LOYALTY_TIER_ORDER = ['new', 'occasional', 'regular', 'loyal'];

@Injectable()
export class ChartsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Replaces ~18 near-identical legacy endpoints (sales-trend, daily-sales,
   * monthly-orders, yearly-sales-trend, cumulative-sales-trend, weekday-sales,
   * hourly-sales, sales-cost-profit-margin-combo, ...) with one parameterized
   * query. Metric/granularity selection is enum-validated before it ever
   * reaches SQL, so this is not the legacy app's "any column, any table"
   * generic engine.
   */
  async getTrend(
    granularity: TrendGranularity,
    metrics: TrendMetric[],
    cumulative: boolean,
  ): Promise<TrendRow[]> {
    const periodExpr = TREND_GRANULARITY_EXPR[granularity];
    const metricSelects = Prisma.join(
      metrics.map(
        (m) => Prisma.sql`${TREND_METRIC_EXPR[m]} AS ${Prisma.raw(m)}`,
      ),
      ', ',
    );

    const rows = await this.prisma.$queryRaw<TrendRow[]>(Prisma.sql`
      SELECT ${periodExpr} AS period, ${metricSelects}
      FROM receipts r
      JOIN receipt_items ri ON ri.receipt_id = r.id
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
    dimension: RankingDimension,
    metric: RankingMetric,
    limit: number,
    order: 'asc' | 'desc',
  ): Promise<RankingRow[]> {
    const { idExpr, nameExpr, joins } = RANKING_DIMENSION_CONFIG[dimension];
    const metricExpr = RANKING_METRIC_EXPR[metric];
    const orderSql = order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    return this.prisma.$queryRaw<RankingRow[]>(Prisma.sql`
      SELECT ${idExpr} AS id, ${nameExpr} AS name, ${metricExpr} AS value
      FROM receipt_items ri
      JOIN receipts r ON r.id = ri.receipt_id
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
    metric: TrendMetric,
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

  private weekdayHourHeatmap(metric: TrendMetric): Promise<HeatmapRow[]> {
    const metricExpr = TREND_METRIC_EXPR[metric];
    return this.prisma.$queryRaw<HeatmapRow[]>(Prisma.sql`
      SELECT EXTRACT(ISODOW FROM r.receipt_date)::int AS x,
             EXTRACT(HOUR FROM r.receipt_time)::int AS y,
             ${metricExpr} AS value
      FROM receipts r
      JOIN receipt_items ri ON ri.receipt_id = r.id
      GROUP BY x, y
      ORDER BY x, y
    `);
  }

  private yearMonthHeatmap(metric: TrendMetric): Promise<HeatmapRow[]> {
    const metricExpr = TREND_METRIC_EXPR[metric];
    return this.prisma.$queryRaw<HeatmapRow[]>(Prisma.sql`
      SELECT EXTRACT(YEAR FROM r.receipt_date)::int AS x,
             EXTRACT(MONTH FROM r.receipt_date)::int AS y,
             ${metricExpr} AS value
      FROM receipts r
      JOIN receipt_items ri ON ri.receipt_id = r.id
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
          FROM receipts r
          JOIN receipt_items ri ON ri.receipt_id = r.id
          GROUP BY r.id
        ) per_receipt
      ) bucketed
      GROUP BY bucket
    `);
    return this.sortByOrder(rows, BASKET_SIZE_ORDER);
  }

  /** Replaces legacy profit-waterfall: sales -> cost -> net profit as three steps. */
  async getProfitWaterfall(): Promise<WaterfallStep[]> {
    const totals = await this.prisma.receiptItem.aggregate({
      _sum: { totalPrice: true, totalCost: true, totalMargin: true },
    });
    return [
      { step: 'sales', value: Number(totals._sum.totalPrice ?? 0) },
      { step: 'cost', value: -Number(totals._sum.totalCost ?? 0) },
      { step: 'profit', value: Number(totals._sum.totalMargin ?? 0) },
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
    metrics: TrendMetric[],
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
