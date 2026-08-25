import type { SalesMetric } from './sales';

export const HEATMAP_TYPES = [
  'weekday-hour',
  'year-month',
  'region-category',
] as const;
export type HeatmapType = (typeof HEATMAP_TYPES)[number];

/**
 * `period` is whatever the chosen granularity groups by: an ISO date for
 * day/week/month/quarter/year, a number for weekday and hour. Metric
 * columns are present only for the metrics that were asked for, which is
 * what makes this Partial rather than a full Record.
 */
export type TrendRow = { period: string | number } & Partial<
  Record<SalesMetric, string | number>
>;

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
