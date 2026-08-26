import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma';
import type {
  BranchRankingRow,
  CashierRankingRow,
  CustomerRankingRow,
  PriceHistoryRow,
  ProductRankingRow,
  RegionCostRow,
  TableRankingRow,
} from '@hakmar/contracts';
import { SALES_METRIC_EXPR, SalesMetric } from '../sales';
import { TableEntity } from './dto/table-ranking-query.dto';

/**
 * These queries were the last ones with no row type at all: `$queryRaw`
 * with no generic returns `unknown`, so a SELECT list that stopped matching
 * what the web renders was nobody's compile error. The shapes come from
 * @hakmar/contracts, parameterised over `Date` where the driver hands back
 * one for a DATE column.
 */
type CustomerRanking = CustomerRankingRow<Date>;
export type RankingRow = TableRankingRow<Date>;

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Replaces 6 legacy table endpoints (top-sales-reps, branch-ranking,
   * product-details, product-detailed-performance,
   * branch-detailed-performance, top-customers) with one route. Each entity
   * has genuinely different useful columns, so this stays four distinct,
   * clearly-written queries selected by a validated enum rather than a
   * forced generic template — the goal is one route/DTO/RBAC/cache config
   * to maintain, not artificially unifying shapes that differ for good
   * reason.
   *
   * All-time only (legacy's branch-ranking was explicitly "full dataset,
   * no period filter" already; top-sales-reps' period filter was dropped
   * here for consistency and to avoid the correctness trap of aggregating
   * across a LEFT JOIN with a date condition in the wrong clause).
   *
   * Every COUNT(...) below is cast ::int — Postgres COUNT returns BIGINT,
   * which surfaces as a JS BigInt that neither JSON.stringify nor the Redis
   * cache serializer can handle (found via the e2e test seeding real rows;
   * an empty table never hits it because zero matching rows means zero
   * BigInts to serialize, not a row containing the BigInt zero).
   */
  async getRanking(entity: TableEntity, limit: number): Promise<RankingRow[]> {
    switch (entity) {
      case TableEntity.CASHIER:
        return this.cashierRanking(limit);
      case TableEntity.BRANCH:
        return this.branchRanking(limit);
      case TableEntity.PRODUCT:
        return this.productRanking(limit);
      case TableEntity.CUSTOMER:
        return this.customerRanking(limit);
    }
  }

  private cashierRanking(limit: number): Promise<CashierRankingRow[]> {
    return this.prisma.$queryRaw<CashierRankingRow[]>(Prisma.sql`
      SELECT ca.id,
             (ca.first_name || ' ' || ca.last_name) AS name,
             br.branch_name AS "branchName",
             ${SALES_METRIC_EXPR[SalesMetric.SALES]} AS "totalSales",
             ${SALES_METRIC_EXPR[SalesMetric.ORDERS]} AS "totalReceipts",
             ${SALES_METRIC_EXPR[SalesMetric.PROFIT]} AS "totalMargin"
      FROM cashiers ca
      JOIN branches br ON br.id = ca.branch_id
      LEFT JOIN receipts r ON r.cashier_id = ca.id
      LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
      GROUP BY ca.id, ca.first_name, ca.last_name, br.branch_name
      ORDER BY "totalSales" DESC
      LIMIT ${limit}
    `);
  }

  private branchRanking(limit: number): Promise<BranchRankingRow[]> {
    return this.prisma.$queryRaw<BranchRankingRow[]>(Prisma.sql`
      SELECT br.id,
             br.branch_name AS name,
             ci.name AS "cityName",
             ${SALES_METRIC_EXPR[SalesMetric.SALES]} AS "totalSales",
             ${SALES_METRIC_EXPR[SalesMetric.ORDERS]} AS "totalReceipts",
             COUNT(DISTINCT r.customer_id)::int AS "uniqueCustomers",
             ${SALES_METRIC_EXPR[SalesMetric.PROFIT]} AS "totalMargin"
      FROM branches br
      JOIN cities ci ON ci.id = br.city_id
      LEFT JOIN receipts r ON r.branch_id = br.id
      LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
      GROUP BY br.id, br.branch_name, ci.name
      ORDER BY "totalSales" DESC
      LIMIT ${limit}
    `);
  }

  private productRanking(limit: number): Promise<ProductRankingRow[]> {
    return this.prisma.$queryRaw<ProductRankingRow[]>(Prisma.sql`
      SELECT p.id,
             p.product_name AS name,
             b.brand_name AS "brandName",
             ${SALES_METRIC_EXPR[SalesMetric.QUANTITY]} AS "totalQuantity",
             ${SALES_METRIC_EXPR[SalesMetric.SALES]} AS "totalSales",
             ${SALES_METRIC_EXPR[SalesMetric.PROFIT]} AS "totalMargin"
      FROM products p
      JOIN brands b ON b.brand_code = p.brand_code
      LEFT JOIN receipt_items ri ON ri.product_id = p.id
      GROUP BY p.id, p.product_name, b.brand_name
      ORDER BY "totalSales" DESC
      LIMIT ${limit}
    `);
  }

  private customerRanking(limit: number): Promise<CustomerRanking[]> {
    return this.prisma.$queryRaw<CustomerRanking[]>(Prisma.sql`
      SELECT c.id,
             (c.first_name || ' ' || c.last_name) AS name,
             ${SALES_METRIC_EXPR[SalesMetric.SALES]} AS "totalSpend",
             ${SALES_METRIC_EXPR[SalesMetric.ORDERS]} AS "totalReceipts",
             MIN(r.receipt_date) AS "firstPurchase",
             MAX(r.receipt_date) AS "lastPurchase"
      FROM customers c
      LEFT JOIN receipts r ON r.customer_id = c.id
      LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
      GROUP BY c.id, c.first_name, c.last_name
      ORDER BY "totalSpend" DESC
      LIMIT ${limit}
    `);
  }

  /**
   * Replaces legacy product-price-change + price-cost-comparison: per
   * product-year, price/cost/margin plus year-over-year price change via
   * a LAG window function. Cost is averaged across regions per year since
   * product_costs varies by (product, region, year) but this table is
   * product-over-time, not product-over-region.
   */
  getPriceCostHistory(limit: number): Promise<PriceHistoryRow[]> {
    return this.prisma.$queryRaw<PriceHistoryRow[]>(Prisma.sql`
      SELECT "productId", "productName", year, price, cost, margin, "previousYearPrice",
        CASE
          WHEN "previousYearPrice" IS NULL OR "previousYearPrice" = 0 THEN NULL
          ELSE ROUND(((price - "previousYearPrice") / "previousYearPrice") * 100, 2)
        END AS "priceChangePct"
      FROM (
        SELECT p.id AS "productId",
               p.product_name AS "productName",
               pp.year,
               pp.unit_price AS price,
               COALESCE(cost_avg.avg_cost, 0) AS cost,
               (pp.unit_price - COALESCE(cost_avg.avg_cost, 0)) AS margin,
               LAG(pp.unit_price) OVER (PARTITION BY p.id ORDER BY pp.year) AS "previousYearPrice"
        FROM products p
        JOIN product_prices pp ON pp.product_id = p.id
        LEFT JOIN (
          SELECT product_id, year, AVG(unit_cost) AS avg_cost
          FROM product_costs
          GROUP BY product_id, year
        ) cost_avg ON cost_avg.product_id = p.id AND cost_avg.year = pp.year
      ) sub
      ORDER BY "productName", year
      LIMIT ${limit}
    `);
  }

  /**
   * Replaces legacy region-cost-analysis + region-cost-comparison: avg cost,
   * total sales and total profit per (region, product). Sales/profit are
   * tied to the exact product_costs row via receipt_items.cost_id, not just
   * matched by product+region, since a product can have several cost rows
   * across years for the same region.
   */
  getRegionCost(limit: number): Promise<RegionCostRow[]> {
    return this.prisma.$queryRaw<RegionCostRow[]>(Prisma.sql`
      SELECT reg.id AS "regionId",
             reg.name AS "regionName",
             p.id AS "productId",
             p.product_name AS "productName",
             COALESCE(AVG(pc.unit_cost), 0) AS "avgCost",
             ${SALES_METRIC_EXPR[SalesMetric.SALES]} AS "totalSales",
             ${SALES_METRIC_EXPR[SalesMetric.PROFIT]} AS "totalProfit"
      FROM product_costs pc
      JOIN regions reg ON reg.id = pc.region_id
      JOIN products p ON p.id = pc.product_id
      LEFT JOIN receipt_items ri ON ri.cost_id = pc.id
      GROUP BY reg.id, reg.name, p.id, p.product_name
      ORDER BY reg.name, p.product_name
      LIMIT ${limit}
    `);
  }
}
