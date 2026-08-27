import { positiveIntFromEnv } from '../common';

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
export const LOGIN_THROTTLE = {
  limit: positiveIntFromEnv('LOGIN_RATE_LIMIT', 5),
  ttl: positiveIntFromEnv('LOGIN_RATE_TTL_MS', 60_000),
};

/**
 * Refresh and logout are cheap and legitimately repeat more often. They share
 * LOGIN_RATE_TTL_MS as their window on purpose: it is one "how long is a rate
 * window here" knob, and splitting it would mean an operator who widened the
 * window for a NAT'd office silently only widened half of it.
 */
export const SESSION_THROTTLE = {
  limit: positiveIntFromEnv('SESSION_RATE_LIMIT', 20),
  ttl: positiveIntFromEnv('LOGIN_RATE_TTL_MS', 60_000),
};
