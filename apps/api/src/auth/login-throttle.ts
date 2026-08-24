/**
 * Login throttling is per-IP, and the default of 5 attempts a minute is
 * tuned for the public internet. That default is deliberately strict, but a
 * deployment where many staff share one egress IP (an office behind a single
 * NAT) needs headroom, or the sixth person to sign in within a minute is
 * locked out by their colleagues rather than by any attack.
 *
 * Read from process.env rather than ConfigService because @Throttle is
 * evaluated when the class is defined, before any provider exists. The
 * values are static configuration, so that is a fair trade.
 */
function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const LOGIN_THROTTLE = {
  limit: positiveInt(process.env.LOGIN_RATE_LIMIT, 5),
  ttl: positiveInt(process.env.LOGIN_RATE_TTL_MS, 60_000),
};

/** Refresh and logout are cheap and legitimately repeat more often. */
export const SESSION_THROTTLE = {
  limit: positiveInt(process.env.SESSION_RATE_LIMIT, 20),
  ttl: positiveInt(process.env.LOGIN_RATE_TTL_MS, 60_000),
};
