import { useQuery } from '@tanstack/react-query';
import { apiClient, type ApiEnvelope } from './api-client';

/** Unwraps the { success, data } envelope every endpoint returns. */
export async function fetchData<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const res = await apiClient.get<ApiEnvelope<T>>(url, { params });
  return res.data.data;
}

export async function postData<T>(
  url: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await apiClient.post<ApiEnvelope<T>>(url, body);
  return res.data.data;
}

/**
 * Every analytics endpoint is a cached GET whose key is exactly its URL plus
 * query string, so the query key mirrors that rather than inventing a
 * parallel naming scheme per page.
 */
export function useApiQuery<T>(
  key: readonly unknown[],
  url: string,
  params?: Record<string, unknown>,
  enabled = true,
) {
  return useQuery({
    queryKey: key,
    queryFn: () => fetchData<T>(url, params),
    enabled,
  });
}
