import { postData, useApiQuery } from '../../lib/query';

/** The map boundaries and the forecast run behind the Tahmin page. */

export function useCityGeoJson<T>() {
  return useApiQuery<T>(['geo', 'geojson', 'city'], '/geo/geojson/city');
}

export interface ForecastRequest {
  mapType: 'city' | 'region';
  metric: string;
  periodMonths: number;
  discountPct: number;
  costChangePct: number;
  purchasingPowerPct: number;
}

export function runForecast<T>(body: ForecastRequest): Promise<T> {
  return postData<T>('/spatial-forecast/run', { ...body });
}
