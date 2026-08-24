import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  [TrendMetric.ORDERS]: Prisma.sql`COUNT(DISTINCT r.id)`,
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
