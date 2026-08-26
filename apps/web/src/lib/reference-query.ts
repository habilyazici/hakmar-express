import type { Page } from '@hakmar/contracts';
import { useApiQuery } from './query';

/**
 * A dropdown's options, read from a resource's own list endpoint.
 *
 * Shared rather than per-feature because the İşlemler filters and the Yönetim
 * forms populate their selects from the same endpoints, and the cache key has
 * to be identical on both sides for one screen's write to refresh the other's
 * dropdown. The endpoint *is* the key, so the two cannot drift apart.
 */
export function useReferenceList<T = Record<string, unknown>>(
  endpoint: string,
  limit = 200,
) {
  return useApiQuery<Page<T>>(['ref', endpoint, limit], endpoint, { limit });
}
