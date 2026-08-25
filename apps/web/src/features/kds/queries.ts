import type {
  AbcRow,
  DemandForecastRow,
  MarketBasketRow,
  RfmRow,
} from '@hakmar/contracts';
import { useApiQuery } from '../../lib/query';

/** The /kds analytics endpoints. Row shapes come from @hakmar/contracts. */
export type {
  AbcRow,
  DemandForecastRow,
  MarketBasketRow,
  RfmRow,
} from '@hakmar/contracts';

export function useAbcAnalysis(days: number) {
  return useApiQuery<AbcRow[]>(['kds', 'abc', days], '/kds/abc-analysis', {
    days,
  });
}

export function useDemandForecast(limit = 50) {
  return useApiQuery<DemandForecastRow[]>(
    ['kds', 'demand-forecast', limit],
    '/kds/demand-forecast',
    { limit },
  );
}

export function useCustomerSegmentation(limit = 100) {
  return useApiQuery<RfmRow[]>(
    ['kds', 'segmentation', limit],
    '/kds/customer-segmentation',
    { limit },
  );
}

/** Disabled until a product is picked — there is no basket without one. */
export function useMarketBasket(productId: number | undefined, limit = 20) {
  return useApiQuery<MarketBasketRow[]>(
    ['kds', 'market-basket', productId, limit],
    '/kds/market-basket',
    { productId, limit },
    productId !== undefined,
  );
}
