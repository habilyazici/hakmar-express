/**
 * The spatial-forecast run: what you ask for and what comes back.
 *
 * Everything here is a plain number, not a decimal string — a forecast is
 * computed in JavaScript from a fitted model rather than read out of a
 * numeric column, so there is no Decimal to preserve.
 */

export const MAP_TYPES = ['city', 'region'] as const;
export type MapType = (typeof MAP_TYPES)[number];

export const FORECAST_METRICS = [
  'quantity',
  'sales',
  'cost',
  'profit',
] as const;
export type ForecastMetric = (typeof FORECAST_METRICS)[number];

export const DISCOUNT_SCOPES = ['all', 'category', 'product'] as const;
export type DiscountScope = (typeof DISCOUNT_SCOPES)[number];

/** Areas with too little history fall back to their mean and say so. */
export const FORECAST_METHODS = ['regression', 'mean'] as const;
export type ForecastMethod = (typeof FORECAST_METHODS)[number];

export interface MetricValues {
  quantity: number;
  sales: number;
  cost: number;
  profit: number;
}

export type MetricChange = Record<keyof MetricValues, number | null>;

export interface AreaForecast {
  id: number;
  name: string;
  plateCode: number | null;
  regionId: number | null;
  regionName: string | null;
  forecast: MetricValues;
  baseline: MetricValues;
  changePct: MetricChange;
  method: ForecastMethod;
  rSquared: number | null;
}

export interface ForecastResult {
  params: {
    mapType: MapType;
    metric: ForecastMetric;
    periodMonths: number;
    discountPct: number;
    discountScope: DiscountScope;
    discountTargetId: number | null;
    costChangePct: number;
    purchasingPowerPct: number;
  };
  model: {
    monthsOfHistory: number;
    areasModeled: number;
    areasFallback: number;
    meanRSquared: number | null;
    /** Share of revenue the discount actually applies to (1 for scope=all). */
    discountShare: number;
  };
  totals: {
    forecast: MetricValues;
    baseline: MetricValues;
    changePct: MetricChange;
  };
  areas: AreaForecast[];
  generatedAt: string;
}

/** What POST /spatial-forecast/run answers: the result plus its recorded id. */
export interface ForecastRunResult extends ForecastResult {
  runId: number;
}
