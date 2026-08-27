import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { AuthUser } from '@hakmar/contracts';
import {
  registerUnauthorizedHandler,
  setAccessToken,
} from '../../lib/api-client';
import { AuthContext } from './auth-context';
import { decodeAccessToken } from './jwt';
import { postLogin, postLogout, postRefresh } from './queries';

/**
 * The refresh token no longer passes through JavaScript at all — it is an
 * httpOnly cookie the browser attaches to /auth/* requests on its own. That
 * means this file can neither read it nor check whether one exists, which is
 * the point: an XSS has nothing to steal here.
 */
async function refresh(): Promise<string | null> {
  try {
    const { accessToken } = await postRefresh();
    setAccessToken(accessToken);
    return accessToken;
  } catch {
    setAccessToken(null);
    return null;
  }
}

/**
 * The backend rotates the refresh token on every use and treats a second
 * presentation of an already-rotated token as theft (revoking the whole
 * session). Without de-duplication here, N components 401-ing at once (e.g.
 * DashboardPage's five parallel queries after the access token expires)
 * would each fire their own refresh with the same cookie — the first to land
 * wins and every sibling is treated as a replay attack, logging the user
 * out. All concurrent callers share one in-flight refresh instead.
 */
let inFlightRefresh: Promise<string | null> | null = null;
function refreshOnce(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = refresh().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  // Always starts true now: with the token in an httpOnly cookie there is no
  // way to know up front whether a session exists, so every cold load has to
  // ask the server. A 401 simply means "not signed in".
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Ending a session throws the query cache away.
   *
   * React Query's cache is a module-level singleton that outlives any one
   * session, and none of it is keyed by user — so signing out and signing
   * back in as someone else served the previous account's cached answers
   * until each key went stale. That is a disclosure on a shared machine, not
   * a rendering quirk: the accounts differ in role precisely so that they see
   * different things.
   */
  const endSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    registerUnauthorizedHandler(async () => {
      const token = await refreshOnce();
      if (!token) {
        endSession();
        return null;
      }
      setUser(decodeAccessToken(token));
      return token;
    });
  }, [endSession]);

  useEffect(() => {
    let cancelled = false;
    refreshOnce()
      .then((token) => {
        if (!cancelled) setUser(token ? decodeAccessToken(token) : null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const { accessToken, user: authUser } = await postLogin(
        username,
        password,
      );
      // Cleared on the way in as well as the way out: a tab that was left
      // open at the login screen can still be holding the previous session's
      // entries, and nothing else would evict them.
      queryClient.clear();
      setAccessToken(accessToken);
      setUser(authUser);
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    // The server clears the cookie; the client drops its in-memory state and
    // everything it had cached under the old session.
    await postLogout();
    endSession();
  }, [endSession]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
