import { useApiQuery } from '../../lib/query';

/**
 * The /tables endpoints, and the shapes they answer with.
 *
 * These row types describe the wire, not the API's own return types — the
 * services behind them build their result sets in raw SQL and hand back
 * whatever Postgres produced. Until those queries carry a row type of their
 * own there is nothing on the API side to check these against, so they stay
 * here rather than in @hakmar/contracts, where every other type is agreed by
 * both sides.
 */

export interface PriceHistoryRow {
  productId: number;
  productName: string;
  year: number;
  price: string;
  cost: string;
  margin: string;
  previousYearPrice: string | null;
  priceChangePct: string | null;
}

export interface RegionCostRow {
  regionId: number;
  regionName: string;
  productId: number;
  productName: string;
  avgCost: string;
  totalSales: string;
  totalProfit: string;
}

export function useTableRanking(entity: string, limit = 100) {
  return useApiQuery<Record<string, unknown>[]>(
    ['tables', 'ranking', entity, limit],
    '/tables/ranking',
    { entity, limit },
  );
}

export function usePriceCostHistory(limit = 300) {
  return useApiQuery<PriceHistoryRow[]>(
    ['tables', 'price-cost-history', limit],
    '/tables/price-cost-history',
    { limit },
  );
}

export function useRegionCost(limit = 300) {
  return useApiQuery<RegionCostRow[]>(
    ['tables', 'region-cost', limit],
    '/tables/region-cost',
    { limit },
  );
}
