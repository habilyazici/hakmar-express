export type { ApiEnvelope } from '@hakmar/contracts';

import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

// withCredentials is what makes the browser attach the httpOnly refresh
// cookie to /auth/* calls; without it the cookie is set but never sent back.
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

/**
 * The access token lives in memory only, and the refresh token is an
 * httpOnly cookie this file never sees. Together that leaves nothing for a
 * script to read — a direct response to the legacy app's #5 critical
 * finding, where an XSS plus a localStorage-stored JWT plus no CSP turned
 * any injection into full session theft. Losing the access token on a hard
 * reload is fine: AuthProvider silently refreshes to get a new one.
 */
let inMemoryAccessToken: string | null = null;
export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

apiClient.interceptors.request.use((config) => {
  if (inMemoryAccessToken) {
    config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }
  return config;
});

type RefreshHandler = () => Promise<string | null>;
let onUnauthorized: RefreshHandler | null = null;
export function registerUnauthorizedHandler(handler: RefreshHandler) {
  onUnauthorized = handler;
}

/**
 * The auth endpoints must never go through the 401-retry path below.
 *
 * /auth/refresh in particular: a 401 from it used to re-enter the very
 * refresh that issued it. Because refreshOnce() hands every concurrent
 * caller the same in-flight promise, the interceptor ended up awaiting the
 * promise it was itself required to settle — a self-referential await that
 * never resolves. The visible symptom was the whole app hanging on a blank
 * screen (isLoading stuck true) whenever the stored refresh token was
 * expired or had been revoked, with no way out but clearing storage.
 *
 * /auth/login and /auth/logout are excluded for a plainer reason: a 401
 * there means "wrong credentials", not "stale access token", so refreshing
 * and replaying the request is never the right response.
 */
const AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];
function isAuthPath(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_PATHS.some((path) => url.startsWith(path));
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    if (
      error.response?.status === 401 &&
      onUnauthorized &&
      original &&
      !original._retried &&
      !isAuthPath(original.url)
    ) {
      original._retried = true;
      const newToken = await onUnauthorized();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
    }
    return Promise.reject(error);
  },
);
