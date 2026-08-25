/**
 * The /kds analytics rows.
 *
 * Money and quantities arrive as decimal strings: they are Postgres
 * `numeric`, and the driver hands back a Decimal that JSON renders as a
 * string rather than risking a float. Anything cast `::int` in the query is
 * a real number here.
 */

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
