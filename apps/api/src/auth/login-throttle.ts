import { throttleFromEnv } from '../common';

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
export const LOGIN_THROTTLE = throttleFromEnv('LOGIN_RATE_LIMIT', 5);

/**
 * Refresh and logout are cheap and legitimately repeat more often — a tab
 * left open renews its session on a timer, and several tabs do it at once.
 */
export const SESSION_THROTTLE = throttleFromEnv('SESSION_RATE_LIMIT', 20);
