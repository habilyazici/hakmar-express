import { positiveIntFromEnv } from './env-int';

/**
 * The window every per-IP limit in this application shares.
 *
 * One knob rather than one per limit: an operator widening it for an office
 * behind a single NAT means "count over a longer period here", and having
 * that only take effect on some of the limits is a trap. It was already
 * shared before this file existed — as `positiveIntFromEnv('LOGIN_RATE_TTL_MS')`
 * spelled out identically in two modules, which is a shared value only for as
 * long as nobody edits one of them.
 */
export const RATE_LIMIT_TTL_MS = positiveIntFromEnv(
  'RATE_LIMIT_TTL_MS',
  60_000,
);

/**
 * A named per-IP limit over that window.
 *
 * The variable name is passed as a literal by every caller rather than
 * composed here, so `grep LOGIN_RATE_LIMIT` still finds the place it is read.
 */
export function throttleFromEnv(
  variable: string,
  fallback: number,
): { limit: number; ttl: number } {
  return {
    limit: positiveIntFromEnv(variable, fallback),
    ttl: RATE_LIMIT_TTL_MS,
  };
}

/**
 * The limit every route inherits unless it declares its own.
 *
 * It was a hardcoded 60 while login, session and forecast were all tunable —
 * which is backwards, because this is the one that fires during ordinary use.
 * A single page load is not a single request: Grafikler mounts six panels
 * that each fetch, and Genel Bakış fetches five. Behind one NAT'd egress
 * address those add up across people, so the limit that protects a public
 * deployment is exactly the limit that locks out an office. 60 stays the
 * default; GLOBAL_RATE_LIMIT is how a deployment says otherwise.
 */
export const GLOBAL_THROTTLE = throttleFromEnv('GLOBAL_RATE_LIMIT', 60);
