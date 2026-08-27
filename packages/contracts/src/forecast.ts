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

/**
 * One row of the run history, as `GET /spatial-forecast/runs` returns it —
 * the parameters a run was made with, without its per-area payload.
 *
 * `mapType`, `metric` and `discountType` are plain strings rather than the
 * unions above, and deliberately so: these are text columns holding a
 * historical record. A run made under a vocabulary that has since changed
 * still has to read back as the thing it was, rather than becoming a value
 * the current union says cannot exist.
 *
 * See ./dashboard for `M` and ./tables for `D`.
 */
export interface ForecastRunSummary<M = string, D = string> {
  id: number;
  mapType: string;
  metric: string;
  periodMonths: number;
  discountPct: M | null;
  discountType: string | null;
  discountTargetId: number | null;
  costChangePct: M | null;
  purchasingPowerPct: M | null;
  createdAt: D;
  /** Null once the account that ran it has been deleted. */
  createdById: number | null;
}

/**
 * A stored run read back in full by `GET /spatial-forecast/runs/:id`.
 *
 * `R` is the recorded payload. It is a JSON column, so the API cannot
 * describe it and leaves it `unknown`; the page that redraws it knows it is
 * a ForecastResult and says so — the same split GeoJsonPayload makes, for
 * the same reason.
 */
export interface ForecastRunRecord<R = unknown, M = string, D = string>
  extends ForecastRunSummary<M, D> {
  resultJson: R;
}
