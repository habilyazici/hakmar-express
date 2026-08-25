export const PERIODS = ['week', 'month', 'quarter', 'year'] as const;
export type Period = (typeof PERIODS)[number];

/**
 * `M` and `D` are the money and date representations.
 *
 * They differ by side and pretending otherwise is what makes a shared type
 * decorative: the API holds a Postgres numeric as a Prisma.Decimal and a
 * date as a Date, and both become strings on the way through JSON. Making
 * that a parameter lets the service and the component each state the
 * contract in its own currency and still be checked against the same
 * definition — instead of the API being exempt from it.
 */
export interface SummaryDto<M = string> {
  totalSales: M;
  totalProfit: M;
}

export interface GeneralStatsDto<M = string> {
  branches: number;
  customers: number;
  products: number;
  brands: number;
  receipts: number;
  cashiers: number;
  totalSales: M;
  totalProfit: M;
}

export interface WindowStats {
  sales: number;
  profit: number;
  orders: number;
  avgBasket: number;
  distinctProducts: number;
}

export interface PerformanceDto {
  period: Period;
  current: WindowStats;
  previous: WindowStats;
  changePct: Record<keyof WindowStats, number | null>;
}

export interface DailySummaryRow<M = string, D = string> {
  day: D;
  sales: M;
  profit: M;
}

export interface MonthlySalesRow<M = string, D = string> {
  month: D;
  sales: M;
  profit: M;
}
