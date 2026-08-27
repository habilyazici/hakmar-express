import type { Page } from '@hakmar/contracts';
import { useApiQuery } from './query';

/** How many options a reference dropdown loads at once. */
export const REFERENCE_PAGE_SIZE = 200;

/**
 * A dropdown's options, read from a resource's own list endpoint.
 *
 * Shared rather than per-feature because the İşlemler filters and the Yönetim
 * forms populate their selects from the same endpoints, and the cache key has
 * to be identical on both sides for one screen's write to refresh the other's
 * dropdown. The endpoint *is* the key, so the two cannot drift apart.
 *
 * `search` goes to the server, which is what makes a list longer than one
 * page usable: the endpoints all accept it, and which columns it matches is
 * fixed per entity by the API. It is part of the cache key, so a filtered
 * view does not overwrite the unfiltered one.
 */
export function useReferenceList<T = Record<string, unknown>>(
  endpoint: string,
  search = '',
  limit = REFERENCE_PAGE_SIZE,
) {
  const trimmed = search.trim();
  return useApiQuery<Page<T>>(
    ['ref', endpoint, limit, trimmed],
    endpoint,
    trimmed ? { limit, search: trimmed } : { limit },
  );
}
