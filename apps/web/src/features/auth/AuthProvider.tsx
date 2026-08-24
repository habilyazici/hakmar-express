import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  apiClient,
  registerUnauthorizedHandler,
  setAccessToken,
  type ApiEnvelope,
} from '../../lib/api-client';
import { AuthContext } from './auth-context';
import { decodeAccessToken } from './jwt';
import type { AuthUser, LoginResponse, RefreshResponse } from './types';

/**
 * The refresh token no longer passes through JavaScript at all — it is an
 * httpOnly cookie the browser attaches to /auth/* requests on its own. That
 * means this file can neither read it nor check whether one exists, which is
 * the point: an XSS has nothing to steal here.
 */
async function refresh(): Promise<string | null> {
  try {
    const res = await apiClient.post<ApiEnvelope<RefreshResponse>>(
      '/auth/refresh',
      {},
    );
    const { accessToken } = res.data.data;
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
  const [user, setUser] = useState<AuthUser | null>(null);
  // Always starts true now: with the token in an httpOnly cookie there is no
  // way to know up front whether a session exists, so every cold load has to
  // ask the server. A 401 simply means "not signed in".
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    registerUnauthorizedHandler(async () => {
      const token = await refreshOnce();
      setUser(token ? decodeAccessToken(token) : null);
      return token;
    });
  }, []);

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

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiClient.post<ApiEnvelope<LoginResponse>>(
      '/auth/login',
      { username, password },
    );
    const { accessToken, user: authUser } = res.data.data;
    setAccessToken(accessToken);
    setUser(authUser);
  }, []);

  const logout = useCallback(async () => {
    // The server clears the cookie; the client only drops in-memory state.
    await apiClient.post('/auth/logout').catch(() => {});
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
