import { Prisma } from '../../generated/prisma/client';
import { SalesDimension, SalesGranularity, SalesMetric } from './sales.model';

/**
 * The SQL vocabulary of the sales read model — the single place that knows
 * how a metric, a time bucket or a breakdown is expressed against the
 * receipt tables.
 *
 * Why this exists: six modules (Charts, Dashboard, Tables, KDS, Spatial
 * Forecast, Transactions) read `receipts` and `receipt_items` directly, and
 * between them they name a metric in thirty places — twenty-six of them
 * spelled out by hand in five services, plus the four in the two lookup
 * tables Charts kept for itself. Renaming a column meant finding all thirty
 * with grep, and grep is the only thing that could have found them: the type
 * system cannot see inside a template literal.
 *
 * What this is NOT: an attempt to funnel every sales query through one
 * generic builder. The modules keep writing their own queries, because
 * their shapes genuinely differ (Tables ranks outward from an entity with
 * LEFT JOINs so zero-sales rows survive; KDS builds multi-stage CTEs).
 * They just compose them from the fragments below instead of restating
 * them.
 *
 * CONTRACT: every fragment here assumes the query aliases `receipts` as `r`
 * and `receipt_items` as `ri`. A query that uses these must use those two
 * aliases — that is the price of sharing the expressions, and it is checked
 * by nothing but this comment and the tests.
 */

/** Canonical join for "one row per sold line item, with its receipt". */
export const SALES_FACT = Prisma.sql`
  FROM receipts r
  JOIN receipt_items ri ON ri.receipt_id = r.id
`;

/**
 * Every COUNT is cast ::int on purpose. Postgres COUNT returns BIGINT,
 * which node-pg/Prisma surface as a JS BigInt, and neither JSON.stringify
 * nor the Redis cache serializer can handle one — an uncast COUNT turns
 * into a 500 the moment real rows exist.
 */
export const SALES_METRIC_EXPR: Record<SalesMetric, Prisma.Sql> = {
  [SalesMetric.SALES]: Prisma.sql`COALESCE(SUM(ri.total_price), 0)`,
  [SalesMetric.COST]: Prisma.sql`COALESCE(SUM(ri.total_cost), 0)`,
  [SalesMetric.PROFIT]: Prisma.sql`COALESCE(SUM(ri.total_margin), 0)`,
  [SalesMetric.QUANTITY]: Prisma.sql`COALESCE(SUM(ri.quantity), 0)`,
  [SalesMetric.ORDERS]: Prisma.sql`COUNT(DISTINCT r.id)::int`,
};

export const SALES_PERIOD_EXPR: Record<SalesGranularity, Prisma.Sql> = {
  [SalesGranularity.DAY]: Prisma.sql`r.receipt_date`,
  [SalesGranularity.WEEK]: Prisma.sql`date_trunc('week', r.receipt_date)`,
  [SalesGranularity.MONTH]: Prisma.sql`date_trunc('month', r.receipt_date)`,
  [SalesGranularity.QUARTER]: Prisma.sql`date_trunc('quarter', r.receipt_date)`,
  [SalesGranularity.YEAR]: Prisma.sql`date_trunc('year', r.receipt_date)`,
  [SalesGranularity.WEEKDAY]: Prisma.sql`EXTRACT(ISODOW FROM r.receipt_date)`,
  [SalesGranularity.HOUR]: Prisma.sql`EXTRACT(HOUR FROM r.receipt_time)`,
};

export interface SalesDimensionJoin {
  idExpr: Prisma.Sql;
  nameExpr: Prisma.Sql;
  /** Joins to add on top of SALES_FACT to reach this dimension. */
  joins: Prisma.Sql;
}

/**
 * How to reach each breakdown from the sales fact. A caller selects a key
 * with a validated enum value; it never supplies SQL text, which is what
 * separates this from the legacy app's generic engine that interpolated
 * request-supplied table and column names straight into a query.
 */
export const SALES_DIMENSION: Record<SalesDimension, SalesDimensionJoin> = {
  [SalesDimension.BRAND]: {
    idExpr: Prisma.sql`b.brand_code`,
    nameExpr: Prisma.sql`b.brand_name`,
    joins: Prisma.sql`JOIN products p ON p.id = ri.product_id JOIN brands b ON b.brand_code = p.brand_code`,
  },
  [SalesDimension.CITY]: {
    idExpr: Prisma.sql`ci.id`,
    nameExpr: Prisma.sql`ci.name`,
    joins: Prisma.sql`JOIN branches br ON br.id = r.branch_id JOIN cities ci ON ci.id = br.city_id`,
  },
  [SalesDimension.BRANCH]: {
    idExpr: Prisma.sql`br.id`,
    nameExpr: Prisma.sql`br.branch_name`,
    joins: Prisma.sql`JOIN branches br ON br.id = r.branch_id`,
  },
  [SalesDimension.REGION]: {
    idExpr: Prisma.sql`reg.id`,
    nameExpr: Prisma.sql`reg.name`,
    joins: Prisma.sql`JOIN branches br ON br.id = r.branch_id JOIN cities ci ON ci.id = br.city_id JOIN regions reg ON reg.id = ci.region_id`,
  },
  [SalesDimension.CATEGORY]: {
    idExpr: Prisma.sql`cat.id`,
    nameExpr: Prisma.sql`cat.name`,
    joins: Prisma.sql`JOIN products p ON p.id = ri.product_id JOIN subcategories sc ON sc.id = p.subcategory_id JOIN categories cat ON cat.id = sc.category_id`,
  },
  [SalesDimension.CASHIER]: {
    idExpr: Prisma.sql`ca.id`,
    nameExpr: Prisma.sql`ca.first_name || ' ' || ca.last_name`,
    joins: Prisma.sql`JOIN cashiers ca ON ca.id = r.cashier_id`,
  },
  [SalesDimension.PRODUCT]: {
    idExpr: Prisma.sql`p.id`,
    nameExpr: Prisma.sql`p.product_name`,
    joins: Prisma.sql`JOIN products p ON p.id = ri.product_id`,
  },
};
