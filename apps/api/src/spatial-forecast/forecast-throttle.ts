import { throttleFromEnv } from '../common';

/**
 * Running a forecast is the most expensive thing this API does, and its
 * result is the one analytics answer that cannot be cached.
 *
 * Every other analytics endpoint answers from Redis for five to sixty
 * minutes, so repeating a request costs almost nothing. `POST
 * /spatial-forecast/run` is deliberately uncached — its parameter space is
 * large and each call is a recorded event — and one call fits three
 * regressions for each of 81 provinces and writes a row. The full-history
 * scan behind it is cached (see spatial-forecast.service.ts), which is what
 * took the worst of the cost out; the rest is still real work, and under the
 * global limit it inherited by omission, holding down the button on the
 * Tahmin page was sixty of them a minute from one signed-in analyst.
 *
 * Ten a minute is far more than the page can produce by hand and still bounds
 * that. The window is the one every per-IP limit here shares, so widening it
 * for a NAT'd office widens all of them together rather than half of them.
 */
export const FORECAST_RUN_THROTTLE = throttleFromEnv('FORECAST_RATE_LIMIT', 10);
