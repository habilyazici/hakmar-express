import { positiveIntFromEnv } from '../common';

/**
 * Running a forecast is the most expensive thing this API does, and it is the
 * one expensive route that cannot be cached.
 *
 * Every other analytics endpoint answers from Redis for five to sixty
 * minutes, so repeating a request costs almost nothing. `POST
 * /spatial-forecast/run` is deliberately uncached — its parameter space is
 * large and each call is a recorded event — and one call reads the entire
 * receipt history, fits three regressions for each of 81 provinces, and
 * writes a row. Under the global 60/minute it inherited by omission, holding
 * down the button on the Tahmin page is sixty full-history scans a minute
 * from one signed-in analyst.
 *
 * Ten a minute is far more than the page can produce by hand and still bounds
 * that. The window is LOGIN_RATE_TTL_MS, the same one every other per-IP
 * limit here uses, so widening it for a NAT'd office widens all of them
 * together rather than half of them.
 */
export const FORECAST_RUN_THROTTLE = {
  limit: positiveIntFromEnv('FORECAST_RATE_LIMIT', 10),
  ttl: positiveIntFromEnv('LOGIN_RATE_TTL_MS', 60_000),
};
