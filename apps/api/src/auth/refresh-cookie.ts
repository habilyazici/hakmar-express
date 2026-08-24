import type { CookieOptions, Response } from 'express';

export const REFRESH_COOKIE = 'hakmar_refresh';

/**
 * The refresh token moved out of the browser's reach entirely.
 *
 * It used to be handed to the client in the login response body and kept in
 * sessionStorage, which undercut the point of holding the access token in
 * memory: any XSS could read a credential good for seven days, whereas the
 * in-memory access token it was protecting lasts twenty minutes. httpOnly
 * means script cannot read this at all.
 *
 * SameSite=Strict is what makes this CSRF-safe without a separate CSRF
 * token: the cookie is the only credential the API accepts from a cookie,
 * and the browser will not attach it to a cross-site request. Every other
 * endpoint authenticates with a Bearer header, which an attacker's page
 * cannot set cross-origin. Path scopes it to the auth routes so it is not
 * sent along with ordinary analytics traffic.
 */
function refreshCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    // Secure must be off for plain-HTTP local development or the browser
    // silently drops the cookie; anything deployed sets COOKIE_SECURE=true.
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: maxAgeMs,
  };
}

export function setRefreshCookie(
  res: Response,
  token: string,
  maxAgeMs: number,
): void {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions(maxAgeMs));
}

/**
 * Clearing has to repeat the same attributes the cookie was set with —
 * browsers match on name plus path, so omitting the path leaves the original
 * cookie in place and the "logout" only appears to work.
 */
export function clearRefreshCookie(res: Response): void {
  // clearCookie sets its own expiry, so maxAge is left out rather than
  // passed as 0 — but every other attribute has to match exactly.
  const { httpOnly, secure, sameSite, path } = refreshCookieOptions(0);
  res.clearCookie(REFRESH_COOKIE, { httpOnly, secure, sameSite, path });
}
