import type {
  ForecastMetric,
  ForecastRunResult,
  MapType,
} from '@hakmar/contracts';
import { postData, useApiQuery } from '../../lib/query';

/** The map boundaries and the forecast run behind the Tahmin page. */

export function useCityGeoJson<T>() {
  return useApiQuery<T>(['geo', 'geojson', 'city'], '/geo/geojson/city');
}

export interface ForecastRequest {
  mapType: MapType;
  metric: ForecastMetric;
  periodMonths: number;
  discountPct: number;
  costChangePct: number;
  purchasingPowerPct: number;
}

export function runForecast(
  body: ForecastRequest,
): Promise<ForecastRunResult> {
  return postData<ForecastRunResult>('/spatial-forecast/run', { ...body });
}
