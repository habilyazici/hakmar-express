import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export const apiClient = axios.create({ baseURL: API_BASE_URL });

/**
 * The access token lives in memory only — never written to localStorage or
 * sessionStorage. This is a direct response to the legacy app's #5 critical
 * finding: an XSS bug + a localStorage-stored JWT + no CSP turned any
 * injection into full session theft. Losing the token on a hard refresh is
 * an acceptable tradeoff; a silent refresh (see auth-context) restores it.
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

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && onUnauthorized && !original._retried) {
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

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}
