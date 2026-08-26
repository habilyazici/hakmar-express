import { useApiQuery } from '../../lib/query';

/** The /kds analytics endpoints. See the note in ../tables/queries.ts on why
 *  these row types live here rather than in @hakmar/contracts. */

export interface AbcRow {
  id: number;
  name: string;
  revenue: string;
  class: 'A' | 'B' | 'C';
}

export interface DemandRow {
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

export interface BasketRow {
  productId: number;
  productName: string;
  coCount: number;
  confidencePct: string | null;
}

export function useAbcAnalysis(days: number) {
  return useApiQuery<AbcRow[]>(['kds', 'abc', days], '/kds/abc-analysis', {
    days,
  });
}

export function useDemandForecast(limit = 50) {
  return useApiQuery<DemandRow[]>(
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
  return useApiQuery<BasketRow[]>(
    ['kds', 'market-basket', productId, limit],
    '/kds/market-basket',
    { productId, limit },
    productId !== undefined,
  );
}
