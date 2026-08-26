import type {
  BucketRow,
  HeatmapRow,
  HeatmapType,
  RankingMetric,
  RankingRow,
  SalesDimension,
  SalesGranularity,
  SalesMetric,
  TrendRow,
  WaterfallStep,
} from '@hakmar/contracts';
import { useApiQuery } from '../../lib/query';

/**
 * Every /charts request the app makes, in one place.
 *
 * Pages call these and never build a URL or a query key themselves: a cache
 * key that disagrees with the parameters actually sent is the kind of bug
 * that shows stale data on one screen and is invisible on every other, and
 * it can only happen where the two are written out separately.
 */

export function useTrend(
  granularity: SalesGranularity,
  metrics: SalesMetric[],
  cumulative: boolean,
) {
  return useApiQuery<TrendRow[]>(
    ['charts', 'trend', granularity, metrics, cumulative],
    '/charts/trend',
    { granularity, metrics: metrics.join(','), cumulative },
  );
}

export function useRanking(
  dimension: SalesDimension,
  metric: RankingMetric,
  order: 'asc' | 'desc',
  limit = 15,
) {
  return useApiQuery<RankingRow[]>(
    ['charts', 'ranking', dimension, metric, order, limit],
    '/charts/ranking',
    { dimension, metric, limit, order },
  );
}

export function useHeatmap(type: HeatmapType, metric: SalesMetric) {
  // region-category is always average unit cost; sending a metric it ignores
  // would only make two cache entries for one answer.
  const isCostMap = type === 'region-category';
  return useApiQuery<HeatmapRow[]>(
    ['charts', 'heatmap', type, isCostMap ? null : metric],
    '/charts/heatmap',
    isCostMap ? { type } : { type, metric },
  );
}

export function useBasketSize() {
  return useApiQuery<BucketRow[]>(
    ['charts', 'basket-size'],
    '/charts/basket-size',
  );
}

export function useCustomerLoyalty() {
  return useApiQuery<BucketRow[]>(
    ['charts', 'customer-loyalty'],
    '/charts/customer-loyalty',
  );
}

export function useProfitWaterfall() {
  return useApiQuery<WaterfallStep[]>(
    ['charts', 'profit-waterfall'],
    '/charts/profit-waterfall',
  );
}
