import type { AuthUser } from './types';

/**
 * Decodes the JWT payload for display purposes only (username/role in the
 * UI). This never substitutes for real verification — every request is
 * independently authenticated and authorized by the API.
 */
export function decodeAccessToken(token: string): AuthUser | null {
  try {
    const [, payload] = token.split('.');
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as AuthUser;
  } catch {
    return null;
  }
}
