import type {
  LoginBody,
  LoginResponse,
  RefreshResponse,
} from '@hakmar/contracts';
import { apiClient, type ApiEnvelope } from '../../lib/api-client';

/**
 * The three /auth requests.
 *
 * These deliberately go through apiClient rather than lib/query.ts: the
 * auth endpoints are the ones excluded from the 401-retry interceptor (a
 * failed refresh must not trigger a refresh), and they are not React Query
 * cache entries — the session is state this app holds in memory, not
 * something to cache and invalidate.
 */

export async function postLogin(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const body: LoginBody = { username, password };
  const res = await apiClient.post<ApiEnvelope<LoginResponse>>(
    '/auth/login',
    body,
  );
  return res.data.data;
}

export async function postRefresh(): Promise<RefreshResponse> {
  const res = await apiClient.post<ApiEnvelope<RefreshResponse>>(
    '/auth/refresh',
    {},
  );
  return res.data.data;
}

export async function postLogout(): Promise<void> {
  // A logout that fails still logs the user out locally; there is nothing
  // useful to do with the error and nothing left to protect.
  await apiClient.post('/auth/logout').catch(() => {});
}
