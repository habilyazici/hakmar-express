import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * One place that decides what loading, failure and emptiness look like, so
 * every analytics panel reports them identically instead of each page
 * inventing its own spinner text and error copy.
 */
export function QueryState<T>({
  query,
  isEmpty,
  emptyText = 'Gösterilecek veri yok.',
  children,
}: {
  query: UseQueryResult<T>;
  isEmpty?: (data: T) => boolean;
  emptyText?: string;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) {
    return (
      <p className="muted" role="status">
        Yükleniyor…
      </p>
    );
  }

  if (query.isError) {
    return (
      <div className="alert" role="alert">
        <span>Veri yüklenemedi.</span>
        <button className="btn" onClick={() => void query.refetch()}>
          Tekrar dene
        </button>
      </div>
    );
  }

  const data = query.data as T;
  if (isEmpty?.(data)) {
    return <p className="muted">{emptyText}</p>;
  }

  return <>{children(data)}</>;
}
