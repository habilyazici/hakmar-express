import type {
  ForecastResult,
  ForecastRunBody,
  ForecastRunRecord,
  ForecastRunResult,
  ForecastRunSummary,
} from '@hakmar/contracts';
import { fetchData, postData, useApiQuery } from '../../lib/query';

/** The map boundaries, the forecast run, and the history of past runs. */

export function useCityGeoJson<T>() {
  return useApiQuery<T>(['geo', 'geojson', 'city'], '/geo/geojson/city');
}

export function runForecast(
  body: ForecastRunBody,
): Promise<ForecastRunResult> {
  return postData<ForecastRunResult>('/spatial-forecast/run', { ...body });
}

/**
 * Past runs, newest first.
 *
 * The page told the user "her çalıştırma kaydedilir ve geçmişten tekrar
 * okunabilir" while offering nothing that could read one back; the two
 * endpoints behind it had existed since the module shipped.
 */
export const FORECAST_RUNS_KEY = ['spatial-forecast', 'runs'] as const;

export function useForecastRuns(limit = 20) {
  return useApiQuery<ForecastRunSummary[]>(
    [...FORECAST_RUNS_KEY, limit],
    '/spatial-forecast/runs',
    { limit },
  );
}

/**
 * Reads one recorded run back as the result it was.
 *
 * Imperative rather than a hook because it answers a click on one row, and
 * the payload is the whole per-area result — not something to hold in the
 * cache for every row the list happens to show.
 */
export async function loadForecastRun(id: number): Promise<ForecastRunResult> {
  const run = await fetchData<ForecastRunRecord<ForecastResult>>(
    `/spatial-forecast/runs/${id}`,
  );
  return { runId: run.id, ...run.resultJson };
}
