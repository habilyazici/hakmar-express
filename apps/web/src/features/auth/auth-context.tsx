import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  apiClient,
  registerUnauthorizedHandler,
  setAccessToken,
  type ApiEnvelope,
} from '../../lib/api-client';
import { decodeAccessToken } from './jwt';
import type { AuthUser, LoginResponse, RefreshResponse } from './types';

const REFRESH_TOKEN_KEY = 'hakmar.refreshToken';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function refreshWithToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await apiClient.post<ApiEnvelope<RefreshResponse>>(
      '/auth/refresh',
      { refreshToken },
    );
    const { accessToken, refreshToken: nextRefreshToken } = res.data.data;
    setAccessToken(accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
    return accessToken;
  } catch {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    setAccessToken(null);
    return null;
  }
}

/**
 * The backend rotates the refresh token on every use and treats a second
 * presentation of an already-rotated token as theft (revoking the whole
 * session). Without de-duplication here, N components 401-ing at once (e.g.
 * DashboardPage's 5 parallel queries after the access token expires) would
 * each call refreshWithToken independently with the same stored token —
 * the first call to land wins, and every sibling gets treated as a replay
 * attack and logs the user out. All concurrent callers now share one
 * in-flight refresh instead.
 */
let inFlightRefresh: Promise<string | null> | null = null;
function refreshOnce(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;
  const stored = sessionStorage.getItem(REFRESH_TOKEN_KEY);
  if (!stored) return Promise.resolve(null);
  inFlightRefresh = refreshWithToken(stored).finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    registerUnauthorizedHandler(async () => {
      const token = await refreshOnce();
      setUser(token ? decodeAccessToken(token) : null);
      return token;
    });

    if (!sessionStorage.getItem(REFRESH_TOKEN_KEY)) {
      setIsLoading(false);
      return;
    }
    refreshOnce()
      .then((token) => setUser(token ? decodeAccessToken(token) : null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiClient.post<ApiEnvelope<LoginResponse>>(
      '/auth/login',
      { username, password },
    );
    const { accessToken, refreshToken, user: authUser } = res.data.data;
    setAccessToken(accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    setUser(authUser);
  }, []);

  const logout = useCallback(async () => {
    const stored = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (stored) {
      await apiClient.post('/auth/logout', { refreshToken: stored }).catch(() => {});
    }
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
