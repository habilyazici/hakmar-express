import { useContext } from 'react';
import type { Role } from '@hakmar/contracts';
import { AuthContext, type AuthContextValue } from './auth-context';

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * Whether the signed-in user holds one of these roles.
 *
 * Mirrors the API's `@Roles()` decorators, and mirrors them for presentation
 * only — the server enforces the same rule on every request whatever this
 * says, which is why duplicating it here is safe. What it buys is honesty: a
 * button whose only possible outcome is 403 is worse than no button, because
 * the user cannot tell a missing permission from a broken screen.
 */
export function useHasRole(...roles: Role[]): boolean {
  const { user } = useAuth();
  return user !== null && roles.includes(user.role);
}
