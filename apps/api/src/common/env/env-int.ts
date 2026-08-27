/**
 * A positive integer read straight from `process.env`.
 *
 * Exists because `@Throttle(...)` — and anything else evaluated while a class
 * is being defined — runs before Nest has instantiated a single provider, so
 * there is no ConfigService yet to read from. These are static values that
 * cannot change while the process runs, so reading the raw environment for
 * them is a fair trade rather than a shortcut. `main.ts` and the Jest setup
 * both load dotenv as their very first import so that a value living only in
 * `.env` is seen here too, exactly as a deployment's real variables would be.
 *
 * Anything that is not a positive integer — unset, empty, "abc", "0", "-1",
 * "1.5" — falls back rather than throwing: a malformed rate limit must not be
 * why an application refuses to boot, and `config/env.validation.ts` already
 * reports a malformed value by name at startup.
 *
 * Callers spell their variable names out as literals rather than composing
 * them, so `grep LOGIN_RATE_LIMIT` still finds every use.
 */
export function positiveIntFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
