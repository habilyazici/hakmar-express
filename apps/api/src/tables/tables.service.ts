import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TableEntity } from './dto/table-ranking-query.dto';

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
  async getRanking(entity: TableEntity, limit: number) {
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

  private cashierRanking(limit: number) {
    return this.prisma.$queryRaw(Prisma.sql`
      SELECT ca.id,
             (ca.first_name || ' ' || ca.last_name) AS name,
             br.branch_name AS "branchName",
             COALESCE(SUM(ri.total_price), 0) AS "totalSales",
             COUNT(DISTINCT r.id)::int AS "totalReceipts",
             COALESCE(SUM(ri.total_margin), 0) AS "totalMargin"
      FROM cashiers ca
      JOIN branches br ON br.id = ca.branch_id
      LEFT JOIN receipts r ON r.cashier_id = ca.id
      LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
      GROUP BY ca.id, ca.first_name, ca.last_name, br.branch_name
      ORDER BY "totalSales" DESC
      LIMIT ${limit}
    `);
  }

  private branchRanking(limit: number) {
    return this.prisma.$queryRaw(Prisma.sql`
      SELECT br.id,
             br.branch_name AS name,
             ci.name AS "cityName",
             COALESCE(SUM(ri.total_price), 0) AS "totalSales",
             COUNT(DISTINCT r.id)::int AS "totalReceipts",
             COUNT(DISTINCT r.customer_id)::int AS "uniqueCustomers",
             COALESCE(SUM(ri.total_margin), 0) AS "totalMargin"
      FROM branches br
      JOIN cities ci ON ci.id = br.city_id
      LEFT JOIN receipts r ON r.branch_id = br.id
      LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
      GROUP BY br.id, br.branch_name, ci.name
      ORDER BY "totalSales" DESC
      LIMIT ${limit}
    `);
  }

  private productRanking(limit: number) {
    return this.prisma.$queryRaw(Prisma.sql`
      SELECT p.id,
             p.product_name AS name,
             b.brand_name AS "brandName",
             COALESCE(SUM(ri.quantity), 0) AS "totalQuantity",
             COALESCE(SUM(ri.total_price), 0) AS "totalSales",
             COALESCE(SUM(ri.total_margin), 0) AS "totalMargin"
      FROM products p
      JOIN brands b ON b.brand_code = p.brand_code
      LEFT JOIN receipt_items ri ON ri.product_id = p.id
      GROUP BY p.id, p.product_name, b.brand_name
      ORDER BY "totalSales" DESC
      LIMIT ${limit}
    `);
  }

  private customerRanking(limit: number) {
    return this.prisma.$queryRaw(Prisma.sql`
      SELECT c.id,
             (c.first_name || ' ' || c.last_name) AS name,
             COALESCE(SUM(ri.total_price), 0) AS "totalSpend",
             COUNT(DISTINCT r.id)::int AS "totalReceipts",
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
}
