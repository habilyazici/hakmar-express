export type Period = 'week' | 'month' | 'quarter' | 'year';

export interface SummaryDto {
  totalSales: string;
  totalProfit: string;
}

export interface GeneralStatsDto {
  branches: number;
  customers: number;
  products: number;
  brands: number;
  receipts: number;
  cashiers: number;
  totalSales: string;
  totalProfit: string;
}

interface WindowStats {
  sales: number;
  profit: number;
  orders: number;
  avgBasket: number;
  distinctProducts: number;
}

export interface PerformanceDto {
  period: string;
  current: WindowStats;
  previous: WindowStats;
  changePct: Record<keyof WindowStats, number | null>;
}

export interface DailySummaryRow {
  day: string;
  sales: string;
  profit: string;
}

export interface MonthlySalesRow {
  month: string;
  sales: string;
  profit: string;
}
