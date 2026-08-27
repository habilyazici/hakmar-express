import type {
  PriceHistoryRow,
  RegionCostRow,
  TableEntity,
  TableRankingRow,
} from '@hakmar/contracts';
import { useApiQuery } from '../../lib/query';

/** The /tables endpoints. Row shapes come from @hakmar/contracts, which the
 *  services behind them are typed from as well. */
export function useTableRanking(entity: TableEntity, limit = 100) {
  // The renderer is one generic column map over four row shapes, so it
  // indexes by key; TableRankingRow is what the API guarantees is behind it.
  return useApiQuery<(TableRankingRow & Record<string, unknown>)[]>(
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
