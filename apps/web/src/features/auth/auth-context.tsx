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
    const res = await apiClient.post<{ success: true; data: RefreshResponse }>(
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    registerUnauthorizedHandler(async () => {
      const stored = sessionStorage.getItem(REFRESH_TOKEN_KEY);
      if (!stored) return null;
      const token = await refreshWithToken(stored);
      if (token) setUser(decodeAccessToken(token));
      else setUser(null);
      return token;
    });

    const stored = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }
    refreshWithToken(stored)
      .then((token) => setUser(token ? decodeAccessToken(token) : null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiClient.post<{ success: true; data: LoginResponse }>(
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
