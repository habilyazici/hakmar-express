import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma';
import { SALES_METRIC_EXPR, SalesMetric } from '../sales';

export interface AbcRow {
  id: number;
  name: string;
  revenue: string;
  class: 'A' | 'B' | 'C';
}

export interface DemandForecastRow {
  productId: number;
  productName: string;
  forecastQty: string;
}

export interface RfmRow {
  id: number;
  name: string;
  recencyDays: number | null;
  frequency: number;
  monetary: string;
  segment: 'Champions' | 'Loyal' | 'At Risk' | 'Lost';
}

export interface MarketBasketRow {
  productId: number;
  productName: string;
  coCount: number;
  confidencePct: string | null;
}

@Injectable()
export class KdsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ABC (Pareto) classification: products ranked by revenue over the
   * window, bucketed by cumulative share — A up to 80%, B up to 95%, C the
   * rest. The date filter lives in a CTE that's joined by product_id
   * *before* the LEFT JOIN to the product dimension (not a condition on the
   * outer LEFT JOIN's ON clause) — the same fix Tables/Charts needed
   * earlier: filtering on the wrong side of a LEFT JOIN either drops
   * zero-revenue products entirely or leaks out-of-window revenue in.
   */
  async getAbcAnalysis(days: number): Promise<AbcRow[]> {
    const rows = await this.prisma.$queryRaw<
      { id: number; name: string; revenue: string }[]
    >(Prisma.sql`
      WITH windowed AS (
        SELECT ri.product_id, ri.total_price
        FROM receipt_items ri
        JOIN receipts r ON r.id = ri.receipt_id
        WHERE r.receipt_date >= CURRENT_DATE - (INTERVAL '1 day' * ${days})
      )
      SELECT p.id, p.product_name AS name,
             COALESCE(SUM(w.total_price), 0) AS revenue
      FROM products p
      LEFT JOIN windowed w ON w.product_id = p.id
      GROUP BY p.id, p.product_name
      ORDER BY revenue DESC
    `);

    const total = rows.reduce((sum, r) => sum + Number(r.revenue), 0);
    let running = 0;
    return rows.map((r) => {
      running += Number(r.revenue);
      const share = total > 0 ? running / total : 1;
      const cls: AbcRow['class'] =
        share <= 0.8 ? 'A' : share <= 0.95 ? 'B' : 'C';
      return { ...r, class: cls };
    });
  }

  /**
   * Per-product 7-day moving average of quantity sold, evaluated at the
   * most recent day it has data — a simple, transparent stand-in for
   * "forecast" (matching the legacy endpoint's own approach: a moving
   * average, not a trained model).
   */
  getDemandForecast(limit: number): Promise<DemandForecastRow[]> {
    return this.prisma.$queryRaw<DemandForecastRow[]>(Prisma.sql`
      WITH daily AS (
        SELECT ri.product_id, r.receipt_date AS day, SUM(ri.quantity) AS qty
        FROM receipt_items ri
        JOIN receipts r ON r.id = ri.receipt_id
        WHERE r.receipt_date >= CURRENT_DATE - INTERVAL '37 days'
        GROUP BY ri.product_id, r.receipt_date
      ),
      moving AS (
        SELECT product_id, day,
               AVG(qty) OVER (
                 PARTITION BY product_id ORDER BY day
                 ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
               ) AS moving_avg_7d
        FROM daily
      ),
      latest AS (
        SELECT DISTINCT ON (product_id) product_id, moving_avg_7d
        FROM moving
        ORDER BY product_id, day DESC
      )
      SELECT p.id AS "productId",
             p.product_name AS "productName",
             COALESCE(l.moving_avg_7d, 0) AS "forecastQty"
      FROM products p
      LEFT JOIN latest l ON l.product_id = p.id
      ORDER BY "forecastQty" DESC
      LIMIT ${limit}
    `);
  }

  /**
   * RFM (Recency/Frequency/Monetary) segmentation via NTILE(4) quartile
   * scoring per dimension, then a simple rule mapping the three scores to a
   * segment label. Frequency is cast ::int for the same BigInt-vs-JSON
   * reason as everywhere else COUNT() shows up in this codebase.
   */
  getCustomerSegmentation(limit: number): Promise<RfmRow[]> {
    return this.prisma.$queryRaw<RfmRow[]>(Prisma.sql`
      WITH customer_stats AS (
        SELECT c.id,
               (c.first_name || ' ' || c.last_name) AS name,
               MAX(r.receipt_date) AS last_purchase,
               ${SALES_METRIC_EXPR[SalesMetric.ORDERS]} AS frequency,
               ${SALES_METRIC_EXPR[SalesMetric.SALES]} AS monetary
        FROM customers c
        LEFT JOIN receipts r ON r.customer_id = c.id
        LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
        GROUP BY c.id, c.first_name, c.last_name
      ),
      scored AS (
        SELECT *,
               CASE WHEN last_purchase IS NULL THEN NULL
                    ELSE (CURRENT_DATE - last_purchase) END AS recency_days,
               NTILE(4) OVER (
                 ORDER BY COALESCE(CURRENT_DATE - last_purchase, 999999) DESC
               ) AS r_score,
               NTILE(4) OVER (ORDER BY frequency ASC) AS f_score,
               NTILE(4) OVER (ORDER BY monetary ASC) AS m_score
        FROM customer_stats
      )
      SELECT id, name,
             recency_days AS "recencyDays",
             frequency,
             monetary,
             CASE
               WHEN r_score >= 3 AND f_score >= 3 AND m_score >= 3 THEN 'Champions'
               WHEN r_score >= 2 AND f_score >= 2 THEN 'Loyal'
               WHEN r_score <= 2 AND f_score >= 3 THEN 'At Risk'
               ELSE 'Lost'
             END AS segment
      FROM scored
      ORDER BY monetary DESC
      LIMIT ${limit}
    `);
  }

  /**
   * Products most often co-purchased with a given product in the same
   * receipt, with a confidence % (co-purchase count / total receipts
   * containing the target product).
   */
  getMarketBasket(
    productId: number,
    limit: number,
  ): Promise<MarketBasketRow[]> {
    return this.prisma.$queryRaw<MarketBasketRow[]>(Prisma.sql`
      WITH target_receipts AS (
        SELECT DISTINCT receipt_id
        FROM receipt_items
        WHERE product_id = ${productId}
      ),
      co_purchases AS (
        SELECT ri.product_id, COUNT(DISTINCT ri.receipt_id)::int AS co_count
        FROM receipt_items ri
        WHERE ri.receipt_id IN (SELECT receipt_id FROM target_receipts)
          AND ri.product_id != ${productId}
        GROUP BY ri.product_id
      ),
      target_count AS (
        SELECT COUNT(*)::int AS total FROM target_receipts
      )
      SELECT p.id AS "productId",
             p.product_name AS "productName",
             cp.co_count AS "coCount",
             ROUND((cp.co_count::numeric / NULLIF(tc.total, 0)) * 100, 1) AS "confidencePct"
      FROM co_purchases cp
      JOIN products p ON p.id = cp.product_id
      CROSS JOIN target_count tc
      ORDER BY cp.co_count DESC
      LIMIT ${limit}
    `);
  }
}
