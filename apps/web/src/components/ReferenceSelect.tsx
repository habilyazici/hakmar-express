import { useId, useState } from 'react';
import { REFERENCE_PAGE_SIZE, useReferenceList } from '../lib/reference-query';

/**
 * A dropdown whose options come from another resource's list endpoint.
 *
 * The three screens that needed one — the Yönetim forms, the İşlemler
 * filters, the Tahmin discount target — each wrote their own, and all three
 * loaded the first 200 rows and stopped. Silently: with more customers than
 * that, the one you wanted simply was not in the list and nothing said why,
 * which reads as missing data rather than as a full page.
 *
 * So the truncation is now visible and escapable. When the endpoint reports
 * more rows than came back, a search box appears and queries the server —
 * every list endpoint takes `search`, and the API decides which columns it
 * matches. Short lists, which is most of them, look exactly as before.
 */
export function ReferenceSelect<T>({
  id,
  endpoint,
  valueKey,
  labelOf,
  value,
  onChange,
  required,
  emptyLabel,
  hint,
}: {
  id?: string;
  endpoint: string;
  /** Which field of a row is the value — `id` everywhere except Brand's `code`. */
  valueKey: string;
  labelOf: (item: T) => string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** The blank option's text: "Tümü" for a filter, "Seçiniz…" for a form. */
  emptyLabel: string;
  hint?: string;
}) {
  const [search, setSearch] = useState('');
  const searchId = useId();
  const query = useReferenceList<T & Record<string, unknown>>(
    endpoint,
    search,
  );

  const page = query.data;
  const items = page?.items ?? [];
  const truncated = page !== undefined && page.total > items.length;

  return (
    <>
      <select
        id={id}
        className="input"
        value={value}
        required={required}
        disabled={query.isPending && items.length === 0}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {query.isPending && items.length === 0 ? 'Yükleniyor…' : emptyLabel}
        </option>
        {items.map((item) => (
          <option key={String(item[valueKey])} value={String(item[valueKey])}>
            {labelOf(item)}
          </option>
        ))}
      </select>

      {/* Only once there is actually something out of reach. */}
      {(truncated || search !== '') && (
        <input
          id={searchId}
          className="input"
          type="search"
          value={search}
          placeholder={`${page?.total ?? 0} kayıttan ilk ${REFERENCE_PAGE_SIZE} tanesi — aratın`}
          aria-label="Listede ara"
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginTop: 4 }}
        />
      )}

      {hint && <span className="field__hint">{hint}</span>}
    </>
  );
}
