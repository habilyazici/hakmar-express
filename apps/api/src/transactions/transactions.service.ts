import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { Page } from '../common';
import { PrismaService } from '../prisma';
import { SALES_METRIC_EXPR, SalesMetric } from '../sales';
import type { ReceiptQueryDto } from './dto/receipt-query.dto';

export interface ReceiptListRow {
  id: number;
  receiptDate: Date;
  receiptTime: Date;
  branchId: number;
  branchName: string;
  cashierName: string;
  customerName: string;
  itemCount: number;
  total: string;
  margin: string;
}

export interface ReceiptItemRow {
  id: number;
  productId: number;
  productName: string;
  brandName: string;
  quantity: string;
  totalPrice: string;
  totalCost: string;
  totalMargin: string;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listReceipts(query: ReceiptQueryDto): Promise<Page<ReceiptListRow>> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const where = this.buildWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<ReceiptListRow[]>(Prisma.sql`
        SELECT r.id,
               r.receipt_date AS "receiptDate",
               r.receipt_time AS "receiptTime",
               br.id AS "branchId",
               br.branch_name AS "branchName",
               (ca.first_name || ' ' || ca.last_name) AS "cashierName",
               (c.first_name || ' ' || c.last_name) AS "customerName",
               COUNT(ri.id)::int AS "itemCount",
               ${SALES_METRIC_EXPR[SalesMetric.SALES]} AS total,
               ${SALES_METRIC_EXPR[SalesMetric.PROFIT]} AS margin
        FROM receipts r
        JOIN branches br ON br.id = r.branch_id
        JOIN cashiers ca ON ca.id = r.cashier_id
        JOIN customers c ON c.id = r.customer_id
        -- LEFT so a receipt with no line items still appears rather than
        -- vanishing from the log it is supposed to be a record of.
        LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
        ${where}
        GROUP BY r.id, r.receipt_date, r.receipt_time, br.id, br.branch_name,
                 ca.first_name, ca.last_name, c.first_name, c.last_name
        ORDER BY r.receipt_date DESC, r.receipt_time DESC, r.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      // Counted without the join to receipt_items: with it the count would
      // be of line items, not receipts.
      this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM receipts r
        ${where}
      `),
    ]);

    return {
      items: rows,
      total: countRows[0]?.count ?? 0,
      limit,
      offset,
    };
  }

  async getReceipt(id: number) {
    const [header] = await this.prisma.$queryRaw<ReceiptListRow[]>(Prisma.sql`
      SELECT r.id,
             r.receipt_date AS "receiptDate",
             r.receipt_time AS "receiptTime",
             br.id AS "branchId",
             br.branch_name AS "branchName",
             (ca.first_name || ' ' || ca.last_name) AS "cashierName",
             (c.first_name || ' ' || c.last_name) AS "customerName",
             COUNT(ri.id)::int AS "itemCount",
             ${SALES_METRIC_EXPR[SalesMetric.SALES]} AS total,
             ${SALES_METRIC_EXPR[SalesMetric.PROFIT]} AS margin
      FROM receipts r
      JOIN branches br ON br.id = r.branch_id
      JOIN cashiers ca ON ca.id = r.cashier_id
      JOIN customers c ON c.id = r.customer_id
      LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
      WHERE r.id = ${id}
      GROUP BY r.id, r.receipt_date, r.receipt_time, br.id, br.branch_name,
               ca.first_name, ca.last_name, c.first_name, c.last_name
    `);

    if (!header) {
      throw new NotFoundException(`Receipt ${id} not found.`);
    }

    const items = await this.prisma.$queryRaw<ReceiptItemRow[]>(Prisma.sql`
      SELECT ri.id,
             p.id AS "productId",
             p.product_name AS "productName",
             b.brand_name AS "brandName",
             ri.quantity,
             ri.total_price AS "totalPrice",
             ri.total_cost AS "totalCost",
             ri.total_margin AS "totalMargin"
      FROM receipt_items ri
      JOIN products p ON p.id = ri.product_id
      JOIN brands b ON b.brand_code = p.brand_code
      WHERE ri.receipt_id = ${id}
      ORDER BY ri.id
    `);

    return { ...header, items };
  }

  /**
   * Filters are assembled from pre-written fragments and every caller value
   * travels as a bound parameter — none of it is ever concatenated into the
   * SQL text. The DTO has already constrained each one to an integer or an
   * ISO date before it reaches here.
   */
  private buildWhere(query: ReceiptQueryDto): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    if (query.dateFrom) {
      conditions.push(
        Prisma.sql`r.receipt_date >= ${new Date(query.dateFrom)}`,
      );
    }
    if (query.dateTo) {
      conditions.push(Prisma.sql`r.receipt_date <= ${new Date(query.dateTo)}`);
    }
    if (query.branchId !== undefined) {
      conditions.push(Prisma.sql`r.branch_id = ${query.branchId}`);
    }
    if (query.cashierId !== undefined) {
      conditions.push(Prisma.sql`r.cashier_id = ${query.cashierId}`);
    }
    if (query.customerId !== undefined) {
      conditions.push(Prisma.sql`r.customer_id = ${query.customerId}`);
    }

    if (conditions.length === 0) return Prisma.empty;
    return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
  }
}
