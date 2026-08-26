import type { ForecastRunBody, ForecastRunResult } from '@hakmar/contracts';
import { postData, useApiQuery } from '../../lib/query';

/** The map boundaries and the forecast run behind the Tahmin page. */

export function useCityGeoJson<T>() {
  return useApiQuery<T>(['geo', 'geojson', 'city'], '/geo/geojson/city');
}

export function runForecast(
  body: ForecastRunBody,
): Promise<ForecastRunResult> {
  return postData<ForecastRunResult>('/spatial-forecast/run', { ...body });
}
