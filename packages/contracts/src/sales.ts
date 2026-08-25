/**
 * The sales vocabulary, as it travels in a query string.
 *
 * The API declares these same members as TypeScript enums in its Sales
 * module and proves the two agree with a compile-time assertion, so adding
 * a metric on one side without the other fails the build rather than
 * producing a 400 nobody sees until a dropdown is clicked.
 */

export const SALES_METRICS = [
  'sales',
  'cost',
  'profit',
  'quantity',
  'orders',
] as const;
export type SalesMetric = (typeof SALES_METRICS)[number];

export const SALES_GRANULARITIES = [
  'day',
  'week',
  'month',
  'quarter',
  'year',
  'weekday',
  'hour',
] as const;
export type SalesGranularity = (typeof SALES_GRANULARITIES)[number];

export const SALES_DIMENSIONS = [
  'brand',
  'city',
  'branch',
  'region',
  'category',
  'cashier',
  'product',
] as const;
export type SalesDimension = (typeof SALES_DIMENSIONS)[number];

/** /charts/ranking exposes three of the five metrics. */
export const RANKING_METRICS = ['sales', 'quantity', 'profit'] as const;
export type RankingMetric = (typeof RANKING_METRICS)[number];
